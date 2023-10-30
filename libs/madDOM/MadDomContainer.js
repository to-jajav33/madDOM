import MadDomTransform from "./MadDomTransform.js";

export class MadDomContainer extends MadDomTransform {
	mad = {
		...this.mad,
		refs: {
			/** @type {HTMLDivElement[]} */
			refAnchor: [],
		},
	}
	constructor(opts = {metaURL: import.meta.url}) {
		super({...opts, metaURL: opts.metaURL ? opts.metaURL : import.meta.url});

		this.origin = this;
	}

	static async loadTemplate() {
		return await this.loadTemplateWithMeta(import.meta.url, this);
	}
}

MadDomContainer.define();

export default MadDomContainer;
