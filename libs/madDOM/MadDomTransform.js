import MadComponent from "../madComponent/MadComponent.js";

export class MadDomTransform extends MadComponent {
	mad = {
		...this.mad,
		refs: {
			/** @type {HTMLDivElement[]} */
			refAnchor: [],
		},
		slots: {
			/** @type {HTMLDivElement | undefined} */
			anchor: undefined
		},
		attrs_type_cast: {
			...this.mad.attrs_type_cast,
			isAnchor: (val) => {
				const isAnchor = (typeof val === 'string' && val.toLowerCase() === 'false') ? false : !!val;

				this.origin.style.position = isAnchor ? 'relative' : 'absolute';
				this.origin.style.backgroundColor = isAnchor ? 'blue' : 'red';
				return isAnchor;
			},
			x: (val) => {
				this.origin.style.left = val; // immediate render
				// this.origin.mad.style.left = val; // render on next optimizedRender
				return val;
			},
			y: (val) => {
				this.origin.style.top = val; // immediate render
				// this.origin.mad.style.top = val; // render on next optimizedRender
				return val;
			},
			scaleX: (val) => {
				val = (val == 0) ? 0 : Number(val) || 1;
				const scaleY = (this.mad.attrs.scaleY == 0) ? 0 : this.mad.attrs.scaleY || 1;

				this.origin.style.transform = `scale(${val}, ${scaleY})`;

				return val;
			},
			scaleY: (val) => {
				val = (val == 0) ? 0 : Number(val) || 1;
				const scaleX = (this.mad.attrs.scaleX == 0) ? 0 : this.mad.attrs.scaleX || 1;
				
				this.origin.style.transform = `scale(${scaleX}, ${val})`;

				return val;
			},
			width: (val) => {
				this.origin.style.width = val;
				return val;
			},
			height: (val) => {
				this.origin.style.height = val;
				return val;
			}
		},
	}
	constructor(opts = {metaURL: import.meta.url}) {
		super({...opts, metaURL: opts.metaURL ? opts.metaURL : import.meta.url});

		this.origin = this;
	}

	get anchor() {
		return this.querySelector('mad-dom-transform');
	}

	async addChild(child) {
		const MadDOM = await this.getMadDOM();
		return await MadDOM.addAt(child, this.origin.children[0]);
	}
	
	async createAt(parent) {
		const MadDom = await this.getMadDOM();
		return await MadDom.createAt(this, parent);
	}

	async getMadDOM() {
		if (!this._MadDOM) {
			const MadDom = (await import("./MadDOM.js")).MadDom;
			this._MadDOM = MadDom;
		}
		return this._MadDOM;
	}

	static async loadTemplate() {
		return await this.loadTemplateWithMeta(import.meta.url, this);
	}

	get x () {
		return this.mad.attrs.x;
	}
	set x (val) {
		this.mad.attrs.x = val;
	}

	get y () {
		return this.mad.attrs.x;
	}
	set y (val) {
		this.mad.attrs.x = val;
	}
}

MadDomTransform.define();

export default MadDomTransform;
