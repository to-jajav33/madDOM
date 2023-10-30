import MadDomTransform from "./MadDomTransform.js";

export class MadDomSprite extends MadDomTransform {
	mad = {
		...this.mad,
		refs: {
			...this.mad.refs,
			/** @type {import('./MadDomTransform.js').MadDomTransform[]} */
			refAnchor: [],
			/** @type {HTMLImageElement[]} */
			refTexture: []
		},
	}
	
	constructor(opts = {metaURL: import.meta.url}) {
		super({...opts, metaURL: opts.metaURL ? opts.metaURL : import.meta.url});
	}

	static async loadTemplate() {
		return await this.loadTemplateWithMeta(import.meta.url, this);
	}

	async setFrames(frames) {
		this.frames = this.frames || [];

		this.frames.splice(0, this.frames.length, ...frames);

		if (this.frames.length) {
			await new Promise((resolve, reject) => {
				this.mad.refs.refTexture[0].onerror = () => {
					reject();
				};
				this.mad.refs.refTexture[0].onload = () => {
					resolve();
				};
				this.mad.refs.refTexture[0].src = frames[0];
			});
		}
	}
}

MadDomSprite.define();

export default MadDomSprite;
