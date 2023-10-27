import MindStore from "../mindStore/MindStore.js";
import MadDomContainer from "./MadDomContainer.js";

export class MadDomSprite extends MadDomContainer {
	mind = {
		...this.mind,
		refs: {
			...this.mind.refs,
			/** @type {import('./MadDomContainer.js').MadDomContainer[]} */
			refContainer: [],
			/** @type {HTMLImageElement[]} */
			refTexture: []
		},
	}
	
	constructor(opts = {metaURL: import.meta.url}) {
		super({...opts, metaURL: opts.metaURL ? opts.metaURL : import.meta.url});
	}

	attached() {
		const image = this.mind.refs.refTexture[0];
		this.mind.refs.refContainer[0].mind.slots.anchor.append(image);
	}

	async setFrames(frames) {
		this.frames = this.frames || [];

		this.frames.splice(0, this.frames.length, ...frames);

		if (this.frames.length) {
			await new Promise((resolve, reject) => {
				this.mind.refs.refTexture[0].onerror = () => {
					reject();
				};
				this.mind.refs.refTexture[0].onload = () => {
					resolve();
				};
				this.mind.refs.refTexture[0].src = frames[0];
			});
		}
	}
}

MadDomSprite.define();

export default MadDomSprite;
