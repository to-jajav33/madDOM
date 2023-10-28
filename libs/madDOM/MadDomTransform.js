import MindComponent from "../mindComponent/MindComponent.js";

export class MadDomTransform extends MindComponent {
	mind = {
		...this.mind,
		refs: {
			/** @type {HTMLDivElement[]} */
			refAnchor: [],
		},
		slots: {
			/** @type {HTMLDivElement | undefined} */
			anchor: undefined
		},
		attrs: {
			...this.mind.attrs,
			isAnchor: (val) => {
				const isAnchor = (typeof val === 'string' && val.toLowerCase() === 'false') ? false : !!val;

				this.origin.style.position = isAnchor ? 'relative' : 'absolute';
				this.origin.style.backgroundColor = isAnchor ? 'blue' : 'red';
				return isAnchor;
			},
			x: (val) => {
				this.origin.style.left = val;
				return val;
			},
			y: (val) => {
				this.origin.style.top = val;
				return val;
			},
			scaleX: (val) => {
				this.origin.style.transform = `scale(${val}, ${this.mind.attrs.scaleY || 0})`;

				return val;
			},
			scaleY: (val) => {
				this.origin.style.transform = `scale(${this.mind.attrs.scaleX || 0}, ${val})`;

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
}

MadDomTransform.define();

export default MadDomTransform;
