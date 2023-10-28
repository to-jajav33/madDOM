// import { getRepeatInfoOf } from "../../../js/learn/helpers/repeatElement.js";
import MindStore from "../mindStore/MindStore.js";

const docFragSpan = document.createElement('span');
const docFrag = document.createDocumentFragment();
docFrag.appendChild(docFragSpan);

function camelToHyphen(key) {
	let hyphenKey = key.replace(key.charAt(key), key.charAt(key).toLowerCase());
	hyphenKey = hyphenKey.replace(/[A-Z]/g, (substr) => `-${substr.toLowerCase()}`);

	return hyphenKey;
}

function promiseFactory() {
	const out = {
		resolve: () => {},
		reject: () => {},
		cancel: () => {},
		status: '',
	};

	out.prom = new Promise((resolve, reject) => {
		out.resolve = (...args) => { if (!out.status){ out.status = 'fulfilled'; resolve(...args); }}
		out.reject = (...args) => { if (!out.status){ out.status = 'rejected'; reject(...args); }};
		out.cancel = (...args) => { if (!out.status){ out.status = 'cancelled'; reject(...args); }};
	});

	return out;
}

export class MindComponent extends HTMLElement {
	mind = {
		actions: {},
		attrs: {},
		refs: {},
		style: {},
		slots: {},
		watch: {}
	};

	constructor(opts = {}) {
		super();

		this.root = this;
		this.lock = {};
		this._allowRenderOptimized = true;
		const style = this.mind.style || {};
		this.mind.style = new Proxy(style, {
			get: (targ, prop) => {
				return targ[prop];
			},
			set: (targ, prop, val) => {
				this._allowRenderOptimized = true;
				targ[prop] = val;
				return true;
			}
		});
		const watchProps = Object.keys(this.mind.watch);
		for (const wProp of watchProps) {
			MindStore.observe(this.mind.watch, [wProp], () => {
				
			});
		}

		this._isTemplateContentFulfilled = false;
		this._isInitReadyFulfilled = false;
		this.isMindComponent = true; // attributes can't be added in constructor, but we can add properties and use this to find mind-components

		this._renderOptimized = this._renderOptimized.bind(this);
		
		this.whenDetachedReadyPromiseController = promiseFactory();
		this.whenDetachedReadyPromiseController.resolve();
		
		this.whenReadyPromiseController = promiseFactory();
		this.whenReady;
		
		if (!this.constructor._templateProm) {
			this.constructor.loadTemplate();
		}
	}

	attributeChangedCallback (name, oldValue, newValue) {
		if (oldValue === newValue) return;

		this.mind.attrs[name] = newValue;
	}

	/**
	 * Init is called when element is first created, cloned elements will not call init.
	 */
	init() {}

	/**
	 * Attache gets called whne added.
	 */
	attached() {}
	detached() {}

	cloneNode(deep) {
		const clone = super.cloneNode(deep);

		// lets mark init resolved if this clone already has initialized content from cloner
		clone._initReady = this._isInitReadyFulfilled ? Promise.resolve() : undefined;
		clone._templateContentReady = this._isTemplateContentFulfilled ? Promise.resolve() : undefined;
		clone.setAttribute('mind-component-is-cloned', true);

		return clone;
	}

	async _allCurrentChildrenComponentsReady () {
		await this.queryMindComponents();
	}

	async queryMindComponents(allComponents = [], children = this.children, allWhenReadys = []) {
		for (let child of children) {
			if (child.children) this.queryMindComponents(allComponents, child.children, allWhenReadys);

			if (child.isMindComponent) {
				allComponents.push(child);
				allWhenReadys.push(child.whenReady);
			} else {
				let checkTimeout;
				try {
					checkTimeout = setTimeout(() => {
						console.warn(child.tagName, ' was not defined before it was instantiated');
					}, 5000);
					await customElements.whenDefined(child.tagName.toLowerCase());
				} catch (e) {
					// e.code 12 === Failed to execute 'whenDefined' on 'CustomElementRegistry': "img" is not a valid custom element name
					if (e.code !== 12) {
						console.error(e);
					}
				}
				clearTimeout(checkTimeout);
			}
		}

		await Promise.allSettled(allWhenReadys);

		return allComponents;
	}

	async _initAddTemplateContent() {
		/** @type {HTMLTemplateElement} */
		const template = this.constructor.__template;
		const clonedContent = template.content.cloneNode(true);

		// pass default attributes
		let nextPrototype = Object.getPrototypeOf(this);
		const defaultAttrs = [];
		while(nextPrototype && (nextPrototype.constructor.name !== 'MindComponent' && nextPrototype.constructor.name !== HTMLElement.name && nextPrototype.constructor.name !== Element.name && nextPrototype.constructor.name !== Node.name)) {
			await nextPrototype.constructor.loadTemplate();
			defaultAttrs.splice(defaultAttrs.length, 0, ...nextPrototype.constructor.__template.attributes);
			const nextNextProto = Object.getPrototypeOf(nextPrototype);
			nextPrototype = nextNextProto;
		}
		for (const attrNode of defaultAttrs) {
			if (!this.hasAttribute(attrNode.name)) {
				this.setAttribute(attrNode.name, attrNode.value);
			}
		}

		this.generateSlots(clonedContent, this);
		this.generateRefs(clonedContent, this.mind.refs);
		this.appendChild(clonedContent);

		await this._allCurrentChildrenComponentsReady();

		const thisAttrs = Object.keys(this.mind.attrs);
		// lets call the attributes to intialize any behaviors
		for (const attrName of thisAttrs) {
			this.mind.attrs[attrName](this.getAttribute(attrName.replace(attrName.charAt(0), attrName.charAt(0).toLowerCase()).replace(/[A-Z]/g, (val) => `-${val.toLowerCase()}`)));
		}

		this._isTemplateContentFulfilled = true;
	}

	async _init() {
		await Promise.resolve(this.init());
		this._isInitReadyFulfilled = true;
	}

	async connectedCallback() {
		try {
			const prevWhenReady = this.whenReady;
			this.whenReady = this.whenReadyPromiseController.prom;

			const currDetachedReady = this.whenDetachedReadyPromiseController.prom;
			if (prevWhenReady) {
				await prevWhenReady;
				await currDetachedReady;
				
				const prevAttached = this.prevAttached;
				this.prevAttached = Promise.resolve(this.attached);
				await prevAttached;
			}

			this.setAttribute('is-mind-component-with-whenready', true);
			if (!this.constructor.__template) {
				await this.constructor._templateProm;
			}
			
			// cloned elements should still wait for their contents to be added.
			if (!this._templateContentReady) {
				this._templateContentReady = this._initAddTemplateContent();
			}
			await this._templateContentReady;

			// this.generateRefs(this, this.mind.refs);
			
			if (this.mind.attrs) {
				const castAttrs = {};
				
				Object.keys(this.mind.attrs).reduce((preVal, currVal, currIndex, arr) => {
					castAttrs[currVal] = this.mind.attrs[currVal];
				}, castAttrs);
				const lastValue = {};
				this.constructor.observedAttributes = () => {
					return Object.keys(castAttrs).map(camelToHyphen);
				};
				
				this.mind.attrs = new Proxy(castAttrs, {
					get: (_targ, prop) => {
						let hyphenProp = camelToHyphen(prop);
						if (typeof castAttrs[prop] !== 'function') {
							return castAttrs[prop];
						}
						return castAttrs[prop](this.getAttribute(hyphenProp));
					},
					set: (_targ, prop, val) => {
						const oldVal = lastValue[prop];
						
						let newVal;
						if (typeof castAttrs[prop] !== 'function') {
							newVal = val;
						} else {
							newVal = castAttrs[prop](val);
						}
						if (oldVal === newVal) return true;
						lastValue[prop] = newVal;
						
						let hyphenProp = camelToHyphen(prop);
						this.setAttribute(hyphenProp, newVal);
	
						if (newVal === undefined || newVal === null) {
							this.removeAttribute(prop);
						}
	
						this.dispatchEvent(new CustomEvent('attribute_changed', {
							detail: {
								prop,
								newVal
							}
						}));

						// const repeatInfo = getRepeatInfoOf(this);
						// if (repeatInfo) {
						// 	repeatInfo.forceUpdate = true;
						// }
						
						return true;
					}
				});
				this.mind.attrs.__isProxy = true;
			}
			
			// only firstAttached call should be init: preferably used to add elements once, instead of adding and removing while attached/detached
			if (!this._initReady) {
				this._initReady = this._init();
			}
			await this._initReady;
			
			// call this before and after init to ensure latest mind.refs exists
			await this._allCurrentChildrenComponentsReady();
			// this.generateRefs(this, this.mind.refs);

			// ensure no async issues occur if element was moved to new location
			await Promise.resolve(this.attached());

			// one last time incase dev added anything during this.attached()
			await this._allCurrentChildrenComponentsReady();
			// this.generateRefs(this, this.mind.refs);

			this.whenReadyPromiseController.resolve(undefined);
			
			requestAnimationFrame(this._renderOptimized);
		} catch (e) {
			this.whenReadyPromiseController.reject(e);
		}
	}

	async disconnectedCallback() {
		const prevDetachedProm = this.whenDetachedReadyPromiseController.prom;
		this.whenDetachedReadyPromiseController = promiseFactory();
		try {
			await this.whenReady;
			await prevDetachedProm;
		} catch (e) {
			console.log(e);
		}

		cancelAnimationFrame(this._lastRenderOptimized);
		
		if (!this._isInitReadyFulfilled) return this.whenDetachedReadyPromiseController.resolve(); // race condition can occur if element changes parents while for _templateProm to finish
		
		await Promise.resolve(this.detached());
		this.whenDetachedReadyPromiseController.resolve()
	}

	generateRefs(elem = this, refObj = this.mind.refs) {
		const mindRefs = elem.querySelectorAll('[mind-ref]');
		for (const refElem of mindRefs) {
			const refName = refElem.getAttribute('mind-ref');
			if (refName) {
				if (!refObj[refName]) refObj[refName] = [];
				if (refObj[refName].indexOf(refElem) < 0) refObj[refName].push(refElem);
			}
		}
	}

	/**
	 * Slots currently only owrk if declared in the html file, they are not dynamic as they are created when template is added. No plans to
	 * make it dynamic, it might make things more confusing??? not sure
	 * 
	 * @param {HTMLElement|DocumentFragment} elem usually this is the template.content (the one with [mind-slot-name="nameOfSlot"])
	 * @param {HTMLElement} addingElem usually this is the 'this' elem. the one requesting to use slots (the one with [mind-slot-ref="nameOfSlot"])
	 * @returns 
	 */
	generateSlots(elem, addingElem) {
		// generate mindSlots
		const mindSlotsQuery = elem.querySelectorAll('[mind-slot-name]');

		const slotElems = [...mindSlotsQuery];
		for (const slotElem of slotElems) {
			const mindSlotName = slotElem.getAttribute('mind-slot-name');
			if (!mindSlotName) {
				console.warn('MindSlot was declared, but no name was provided.');
				return;
			}

			this.mind.slots[mindSlotName] = slotElem;
		}
	}

	// /**
	//  * Slots currently only owrk if declared in the html file, they are not dynamic as they are created when template is added. No plans to
	//  * make it dynamic, it might make things more confusing??? not sure
	//  * 
	//  * @param {HTMLElement|DocumentFragment} elem usually this is the template.content (the one with [mind-slot-name="nameOfSlot"])
	//  * @param {HTMLElement} addingElem usually this is the 'this' elem. the one requesting to use slots (the one with [mind-slot-ref="nameOfSlot"])
	//  * @returns 
	//  */
	// generateSlots(elem, addingElem) {
	// 	// generate mindSlots
	// 	const mindSlotsQuery = elem.querySelectorAll('template[mind-slot-name]');

	// 	const deref = [...mindSlotsQuery];
	// 	for (const tmplt of deref) {
			
	// 		const mindSlotName = tmplt.getAttribute('mind-slot-name');
	// 		if (!mindSlotName) {
	// 			console.warn('MindSlot was declared, but no name was provided.');
	// 			return;
	// 		}

	// 		const addee = addingElem.querySelector(`:scope > [mind-slot-ref="${mindSlotName}"]`);
	// 		const newElement = addee ? addee : tmplt.content.childNodes.length ? tmplt.content.cloneNode(true) : undefined;

	// 		if (!newElement) {
	// 			tmplt.remove(); // leaving the template just clutters mind.refs (adding :not(template) to mind.refs query might help if we want to keep template)
	// 			continue;
	// 		}

	// 		tmplt.parentNode.replaceChild(newElement, tmplt);
	// 	}
	// }


	static async loadTemplateWithMeta(metaUrl, paramClass) {
		if (paramClass._templateProm) return await paramClass._templateProm;
		
		paramClass._templateProm = paramClass._loadTemplate(metaUrl, paramClass);
		return await paramClass._templateProm;
	}

	static async loadTemplate() {
		throw(`should override this function.

			static async loadTemplate {
				return await this.loadTemplateWithMeta(import.meta.url, this);
			}
		`);
	}

	static async _loadTemplate(metaURL, paramClass) {
		if (!paramClass.__template) {
			const htmlResp = await fetch(metaURL.replace('.js', '.html'));
			if (htmlResp.status !== 200) throw(`${htmlResp.statusText} ${htmlResp.url}`);

			const html = await htmlResp.text();
			docFragSpan.innerHTML = '';
			docFragSpan.innerHTML = html;
			paramClass.__template = docFragSpan.querySelector('template');
			if (!paramClass.__template) {
				docFragSpan.innerHTML = `<template>${html}</template>`;
				paramClass.__template = docFragSpan.querySelector('template');
			}
			const srcs = paramClass.__template.content.querySelectorAll('[src]');
			const hrefs = paramClass.__template.content.querySelectorAll('[href]');

			let brokenURL = metaURL.split('/');
			brokenURL.splice(-1, 1);
			
			let rootURL = brokenURL.join('/');
			if (!rootURL.endsWith('/')) rootURL = rootURL + '/';
			for (const elem of srcs) {
				if (elem.attributes.src.nodeValue.startsWith('.')) {
					elem.attributes.src.nodeValue = rootURL + elem.attributes.src.nodeValue
				}

				/** @todo optimize, if src already exists lets remove????/commentout???/block-fetch??? it to save on cache/network calls */
			}
			for (const elem of hrefs) {
				if (elem.attributes.href.nodeValue.startsWith('.')) {
					elem.attributes.href.nodeValue = rootURL + elem.attributes.href.nodeValue;
				}

				/** @todo optimize, if src already exists lets remove????/commentout???/block-fetch??? it to save on cache/network calls */
			}
			docFragSpan.innerHTML = '';
		}
	}

	/**
	 * 
	 * @param {string} qStr 
	 * @param {number} timeout 
	 */
	static async querySelectorAll(qStr, timeout = 100, numberOfTries = 2, currNumOfTries = 0) {
		return await new Promise((resolve, reject) => {
			try {
				const elems = document.querySelectorAll(qStr);
	
				if (elems.length) {
					resolve(elems);
				} else if (currNumOfTries < numberOfTries){
					setTimeout(() => {
						resolve(MindComponent.querySelectorAll(qStr, timeout, numberOfTries, currNumOfTries++));
					}, timeout);
				} else {
					resolve([]);
				}
			} catch(e) {
				reject(e);
			}
		});
	}

	renderOptimized() {}

	_renderOptimized() {
		const framePerSecond = 12;
		const newNowInMs = performance.now();
		const maxTimePassedInMs = (framePerSecond / 60) * 1000.0;
		const isFirstRender = this.lastRenderNow === undefined;

		const newDeltaTime = newNowInMs - (this.lastRenderNow || 0.0);
		this.collectedRenderTime = (this.collectedRenderTime || 0.0) + newDeltaTime;
		this.lastRenderNow = newNowInMs;

		if ((this._allowRenderOptimized && this.collectedRenderTime >= maxTimePassedInMs) || isFirstRender) {
			this.collectedRenderTime = 0.0;
			Object.assign(this.style, this.mind.style);
			this.renderOptimized();
			this._allowRenderOptimized = false;
		}

		this._lastRenderOptimized = requestAnimationFrame(this._renderOptimized);
	}
	
	static define() {
		const hyphenName = (this.name.replace(this.name.charAt(0), this.name.charAt(0).toLowerCase())).replace(/[A-Z]/g, m => "-" + m.toLowerCase());
		if (self.customElements.get(hyphenName)) return hyphenName;

		self.customElements.define(hyphenName, this);
		return hyphenName;
	}
}

export default MindComponent;
