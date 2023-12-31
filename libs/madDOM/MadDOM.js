export class MadDom {

	/**
	 * @template {T}
	 *
	 * @param {T} elem
	 * @param {HTMLElement} parent
	 * @memberof MadDom
	 * 
	 * @returns {InstanceType<T>}
	 */
	static async addAt(elem, parent) {
		MadDom.define(elem.constructor);

		if (parent) {
			parent.appendChild(elem);
			await elem.whenReady;
		}

		return elem;
	}

	/**
	 * @template {T extends abstract new (...args: any) => any}
	 *
	 * @param {T} ElemClass
	 * @param {HTMLElement} parent
	 * @memberof MadDom
	 * 
	 * @returns {InstanceType<T>}
	 */
	static async createAt(ElemClass, parent) {
		MadDom.define(ElemClass);
		const container = new ElemClass();

		if (parent) {
			return MadDom.addAt(container, parent);
		}

		return container;
	}

	static define(paramClass) {
		const hyphenName = (paramClass.name.replace(paramClass.name.charAt(0), paramClass.name.charAt(0).toLowerCase())).replace(/[A-Z]/g, m => "-" + m.toLowerCase());
		if (self.customElements.get(hyphenName)) return hyphenName;

		self.customElements.define(hyphenName, paramClass);
		return hyphenName;
	}

	/**
	 * 
	 * @returns {InstanceType<import('./MadDomContainer.js').MadDomContainer>}
	 */
	static get MadDomContainer() {
		return import('./MadDomContainer.js').then((modules) => {
			MadDom.define(modules.MadDomContainer);
			return modules.MadDomContainer;
		});
	}

	/**
	 * 
	 * @returns {InstanceType<import('./MadDomSprite.js').MadDomSprite>}
	 */
	static get MadDomSprite() {
		return import('./MadDomSprite.js').then((modules) => {
			MadDom.define(modules.MadDomSprite);
			return modules.MadDomSprite;
		});
	}

	/**
	 * 
	 * @returns {InstanceType<import('./MadDomStageRatio.js').MadDomStageRatio>}
	 */
	static get MadDomStageRatio() {
		return import('./MadDomStageRatio.js').then((modules) => {
			MadDom.define(modules.MadDomStageRatio);
			return modules.MadDomStageRatio;
		});
	}


	static get canvasResolution() {
		MadDom._canvasResolution = MadDom._canvasResolution || 1;
		document.documentElement.style.setProperty(`--canvas-resolution`, MadDom._canvasResolution);
		return MadDom._canvasResolution;
	}
	static set canvasResolution(val) {
		MadDom._canvasResolution = val;
		document.documentElement.style.setProperty(`--canvas-resolution`, MadDom._canvasResolution);
	}
}

MadDom.canvasResolution = 1;

export default MadDom;
