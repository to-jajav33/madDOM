import MindComponent from "../mindComponent/MindComponent.js";

export class MadDomContainer extends MindComponent {
	mind = {
		...this.mind,
		refs: {
			/** @type {HTMLDivElement[]} */
			refAnchor: [],
			/** @type {HTMLDivElement[]} */
			refOrigin: [],
		},
		slots: {
			/** @type {HTMLDivElement | undefined} */
			anchor: undefined
		},
		attrs: {
			x: (val) => {
				this.mind.refs.refOrigin[0].style.left = val;
				return val;
			},
			y: (val) => {
				this.mind.refs.refOrigin[0].style.top = val;
				return val;
			},
			scaleX: (val) => {
				this.mind.refs.refOrigin[0].style.transform = `scale(${val}, ${this.mind.attrs.scaleY || 0})`;

				return val;
			},
			scaleY: (val) => {
				this.mind.refs.refOrigin[0].style.transform = `scale(${this.mind.attrs.scaleX || 0}, ${val})`;

				return val;
			},
			width: (val) => {
				this.mind.refs.refOrigin[0].style.width = val;
				return val;
			},
			height: (val) => {
				this.mind.refs.refOrigin[0].style.height = val;
				return val;
			}
		},
	}
	constructor(opts = {metaURL: import.meta.url}) {
		super({...opts, metaURL: opts.metaURL ? opts.metaURL : import.meta.url});
	}

	async getMadDOM() {
		if (!this._MadDOM) {
			const MadDom = (await import("./MadDOM.js")).MadDom;
			this._MadDOM = MadDom;
		}
		return this._MadDOM;
	}
	
	async createAt(parent) {
		const MadDom = await this.getMadDOM();
		return await MadDom.createAt(this, parent);
	}

	async addChild(child) {
		const MadDOM = await this.getMadDOM();
		return await MadDOM.addAt(child, this);
	}
}

MadDomContainer.define();

export default MadDomContainer;
