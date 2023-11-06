// import { getRepeatInfoOf } from "../../../js/learn/helpers/repeatElement.js";
import MadStore from "../madStore/MadStore.js";

const docFragSpan = document.createElement('span');
const docFrag = document.createDocumentFragment();
docFrag.appendChild(docFragSpan);

function camelToHyphen(key) {
	let hyphenKey = key.replace(key.charAt(0), key.charAt(0).toLowerCase());
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

export class MadComponent extends HTMLElement {
	mad = {
		actions: {},
		attrs: {},
		attrs_type_cast: {},
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
		const style = this.mad.style || {};
		this.mad.style = new Proxy(style, {
			get: (targ, prop) => {
				return targ[prop];
			},
			set: (targ, prop, val) => {
				this._allowRenderOptimized = true;
				targ[prop] = val;
				return true;
			}
		});
		const watchProps = Object.keys(this.mad.watch);
		for (const wProp of watchProps) {
			MadStore.observe(this.mad.watch, [wProp], () => {
				
			});
		}

		this._isTemplateContentFulfilled = false;
		this._isInitReadyFulfilled = false;
		this.isMadComponent = true; // attributes can't be added in constructor, but we can add properties and use this to find mad-components

		this._renderOptimized = this._renderOptimized.bind(this);
		
		this.whenDetachedReadyPromiseController = promiseFactory();
		this.whenDetachedReadyPromiseController.resolve();
		
		this.whenReadyPromiseController = promiseFactory();
		this.whenReady;
		
		if (!MadComponent.templatePromises.get(this.constructor)) {
			this.constructor.loadTemplate();
		}
	}

	attributeChangedCallback (name, oldValue, newValue) {
		if (oldValue === newValue) return;
		this.mad.attrs[name] = newValue;
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
		clone.setAttribute('mad-component-is-cloned', true);

		return clone;
	}

	async _allCurrentChildrenComponentsReady () {
		await this.queryMadComponents();
	}

	async queryMadComponents(allComponents = [], children = this.children, allWhenReadys = []) {
		for (let child of children) {
			if (child.children) this.queryMadComponents(allComponents, child.children, allWhenReadys);

			if (child.isMadComponent) {
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
		if (this._templateContentReady) return this._templateContentReady;

		/** @type {HTMLTemplateElement} */
		let template = MadComponent.templates.get(this.constructor);
		const clonedContent = template.content.cloneNode(true);
		
		const defaultAttrs = [];
		// ensure "this.attributes" override all other attributes by being the first
		defaultAttrs.splice(defaultAttrs.length, 0, ...template.attributes);

		// pass default attributes
		let nextPrototype = Object.getPrototypeOf(this.constructor);
		while(nextPrototype && (nextPrototype.name !== 'MadComponent' && nextPrototype.name !== HTMLElement.name && nextPrototype.constructor.name !== Element.name && nextPrototype.constructor.name !== Node.name)) {
			await nextPrototype.loadTemplate();
			template = MadComponent.templates.get(nextPrototype);
			defaultAttrs.splice(defaultAttrs.length, 0, ...template.attributes);
			const nextNextProto = Object.getPrototypeOf(nextPrototype);
			nextPrototype = nextNextProto;
		}
		for (const attrNode of defaultAttrs) {
			if (!this.hasAttribute(attrNode.name)) {
				this.setAttribute(attrNode.name, attrNode.value);
			}
		}

		this.generateSlots(clonedContent, this);
		this.generateRefs(clonedContent, this.mad.refs);
		this.appendChild(clonedContent);

		await this._allCurrentChildrenComponentsReady();

		const thisAttrs = Object.keys(this.mad.attrs_type_cast);
		// lets call the attributes to intialize any behaviors
		for (const attrName of thisAttrs) {
			this.mad.attrs[attrName] = (this.getAttribute(camelToHyphen(attrName)));
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

			this.setAttribute('is-mad-component-with-whenready', true);
			if (!MadComponent.templates.get(this.constructor)) {
				await MadComponent.templatePromises.get(this.constructor);
			}

			this.createAttributeListeners();
			
			// loading template is static, setting attributes and refs is instance related.
			// the following is meant to add instance related stuff.
			if (!this._templateContentReady) {
				this._templateContentReady = this._initAddTemplateContent();
			}
			await this._templateContentReady;
			
			// only firstAttached call should be init: preferably used to add elements once, instead of adding and removing while attached/detached
			if (!this._initReady) {
				this._initReady = this._init();
			}
			await this._initReady;
			
			// call this before and after init to ensure latest mad.refs exists
			await this._allCurrentChildrenComponentsReady();
			// this.generateRefs(this, this.mad.refs);

			// ensure no async issues occur if element was moved to new location
			await Promise.resolve(this.attached());

			// one last time incase dev added anything during this.attached()
			await this._allCurrentChildrenComponentsReady();
			// this.generateRefs(this, this.mad.refs);

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

	createAttributeListeners() {
		const castAttrs = this.mad.attrs_type_cast;
		this.constructor.observedAttributes = () => {
			return Object.keys(castAttrs).map(camelToHyphen);
		};
		const lastValue = {};
		
		this.mad.attrs.__isProxy = true;
		this.mad.attrs = new Proxy(lastValue, {
			get: (targ, prop) => {
				return targ[prop];
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
	}

	generateRefs(elem = this, refObj = this.mad.refs) {
		const madRefs = elem.querySelectorAll('[mad-ref]');
		for (const refElem of madRefs) {
			const refName = refElem.getAttribute('mad-ref');
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
	 * @param {HTMLElement|DocumentFragment} elem usually this is the template.content (the one with [mad-slot-name="nameOfSlot"])
	 * @param {HTMLElement} addingElem usually this is the 'this' elem. the one requesting to use slots (the one with [mad-slot-ref="nameOfSlot"])
	 * @returns 
	 */
	generateSlots(elem, addingElem) {
		// generate madSlots
		const madSlotsQuery = elem.querySelectorAll('[mad-slot-name]');

		const slotElems = [...madSlotsQuery];
		for (const slotElem of slotElems) {
			const madSlotName = slotElem.getAttribute('mad-slot-name');
			if (!madSlotName) {
				console.warn('MadSlot was declared, but no name was provided.');
				return;
			}

			this.mad.slots[madSlotName] = slotElem;
		}
	}

	// /**
	//  * Slots currently only owrk if declared in the html file, they are not dynamic as they are created when template is added. No plans to
	//  * make it dynamic, it might make things more confusing??? not sure
	//  * 
	//  * @param {HTMLElement|DocumentFragment} elem usually this is the template.content (the one with [mad-slot-name="nameOfSlot"])
	//  * @param {HTMLElement} addingElem usually this is the 'this' elem. the one requesting to use slots (the one with [mad-slot-ref="nameOfSlot"])
	//  * @returns 
	//  */
	// generateSlots(elem, addingElem) {
	// 	// generate madSlots
	// 	const madSlotsQuery = elem.querySelectorAll('template[mad-slot-name]');

	// 	const deref = [...madSlotsQuery];
	// 	for (const tmplt of deref) {
			
	// 		const madSlotName = tmplt.getAttribute('mad-slot-name');
	// 		if (!madSlotName) {
	// 			console.warn('MadSlot was declared, but no name was provided.');
	// 			return;
	// 		}

	// 		const addee = addingElem.querySelector(`:scope > [mad-slot-ref="${madSlotName}"]`);
	// 		const newElement = addee ? addee : tmplt.content.childNodes.length ? tmplt.content.cloneNode(true) : undefined;

	// 		if (!newElement) {
	// 			tmplt.remove(); // leaving the template just clutters mad.refs (adding :not(template) to mad.refs query might help if we want to keep template)
	// 			continue;
	// 		}

	// 		tmplt.parentNode.replaceChild(newElement, tmplt);
	// 	}
	// }


	static async loadTemplateWithMeta(metaUrl, paramClass) {
		let templProm = MadComponent.templatePromises.get(paramClass);
		if (templProm) return await templProm;
		
		templProm = paramClass._loadTemplate(metaUrl, paramClass);
		MadComponent.templatePromises.set(paramClass, templProm);
		return await templProm;
	}

	static async loadTemplate() {
		throw(`should override this function.

			static async loadTemplate {
				return await this.loadTemplateWithMeta(import.meta.url, this);
			}
		`);
	}

	static async _loadTemplate(metaURL, paramClass) {
		if (!MadComponent.templates.get(this.constructor)) {
			const htmlResp = await fetch(metaURL.replace('.js', '.html'));
			if (htmlResp.status !== 200) throw(`${htmlResp.statusText} ${htmlResp.url}`);

			const html = await htmlResp.text();
			docFragSpan.innerHTML = '';
			docFragSpan.innerHTML = html;
			let template = docFragSpan.querySelector('template');
			if (!template) {
				docFragSpan.innerHTML = `<template>${html}</template>`;
				template = docFragSpan.querySelector('template');
			}
			MadComponent.templates.set(this, template);
			const srcs = template.content.querySelectorAll('[src]');
			const hrefs = template.content.querySelectorAll('[href]');

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
						resolve(MadComponent.querySelectorAll(qStr, timeout, numberOfTries, currNumOfTries++));
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
			Object.assign(this.style, this.mad.style);
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

MadComponent.templates = new Map();
MadComponent.templatePromises = new Map();

export default MadComponent;
