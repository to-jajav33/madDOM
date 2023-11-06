import MadComponent from "../madComponent/MadComponent.js";

export class MadDomStageRatio extends MadComponent {
	mad = {
		...this.mad,
	}
	
	constructor(opts = {metaURL: import.meta.url}) {
		super({...opts, metaURL: opts.metaURL ? opts.metaURL : import.meta.url});
	}

	static async loadTemplate() {
		return await this.loadTemplateWithMeta(import.meta.url, this);
	}
}

MadDomStageRatio.define();

export default MadDomStageRatio;
