
const stores = {};

/** @type {Map<object, {deeperProxies: ProxyConstructor, listeners: Record<string, Array<{scope: unknown, fn: (newVal: unknown, oldVal: unknown) => void}, debounce: number| null}>>} */
const observedStores = new Map();

export const MindStore = {
	/**
	 * @template T
	 * @param {string} url name or url to store the instance of store in
	 * @param {T} paramClass Class to use as store
	 * @returns {function(): InstanceType<T> | Promise<InstanceType<T>>} A function that returns the Store singleton
	 */
	define: (url, paramClass) => {
		return () => {
			if (!stores[url]) {
				/** @todo add middle ware here. Maybe through a proxy? */
				const inst = new paramClass();
				stores[url] = new Proxy(inst, {
					get: (_targ, prop) => {
						if (MindStore.__debug__ && typeof _targ[prop] === 'function' && !_targ[prop].__isBinded__) {
							const oldFn = _targ[prop];
							_targ[prop] = function (...args) {
								console.group(`calling ${_targ.constructor.name}::${prop}`);
									console.group('args');
										console.log(`args ${args.join(', ')}`);
									console.groupEnd();
									console.trace();
								console.groupEnd();

								return oldFn.apply(_targ, args);
							};
							_targ[prop].__isBinded__ = true;
						}
						return inst[prop];
					},
					set: (_targ, prop, val) => {
						const oldVal = inst[prop];
						inst[prop] = val;

						if (oldVal !== val && observedStores.has(stores[url])) {
							const info = observedStores.get(stores[url]);
							
							if (info.deeperProxies[prop] && val === undefined) {
								// release for garbage collection
								info.deeperProxies[prop] = undefined;
							}

							if (info && info.listeners[prop]) {
								const fns = info.listeners[prop];
								for (const fnInfo of fns) {
									fnInfo.fn.call(fnInfo.scope, val, oldVal)
								}
							}
						}
						return true;
					}
				});
				stores[url].____isMindStoreProxy____ = true;

				// if init is a promise, return a promise that when resolved, returns store
				if (typeof stores[url].init === 'function') {
					const result = stores[url].init();
					if (result instanceof Promise) {
						return result.then(() => stores[url]);
					}
				}
			}

			return stores[url];
		};
	},
	/** 
	 * @template {object} T
	 * @param {T} store
	 * @param {Array<string>} arrOfProps
	 * @param {() => void} listener
	 * @param {any} scope
	 * 
	 * @returns {[T]}
	 * */
	observe: (store, arrOfProps, listener, scope) => {
		if (!store.____isMindStoreProxy____) throw('Must use the returned store from MindStore.define function');
		if (!arrOfProps.length) return console.warn('Invalid properties to observer');

		const info = observedStores.get(store) || {listeners: {}, deeperProxies: {}, debounce: null};
		const {listeners, deeperProxies} = info;
		// currently only supports one level deep
		/** @todo make the proxy detect if new val is an object, if so, make into a proxy as well based on array of props */
		const prop = arrOfProps[0];
		listeners[prop] = listeners[prop] || [];
		listeners[prop].push({scope, fn: listener});

		// listen to changes in an array and object. 1 level deep
		if ((!deeperProxies[prop]) && (store[prop] && typeof store[prop] === 'object')) {
			store[prop] = deeperProxies[prop] = new Proxy(store[prop], {
				get: (targ, index) => {
					return targ[index];
				},
				set: (targ, index, val) => {
					const oldVal = targ[index];
					targ[index] = val;

					if (oldVal !== val && info && info.listeners[prop]) {
						const fns = info.listeners[prop];
						for (const fnInfo of fns) {
							clearTimeout(info.debounce);
							info.debounce = setTimeout(() => {
								fnInfo.fn.call(fnInfo.scope, val, oldVal)
							}, 300);
						}
					}
					return true;
				}
			});
		}
		observedStores.set(store, info);
	},
	deobserve: (store, arrOfProps, listener) => {
		const info = observedStores.get(store) || {listeners: {}};
		const {listeners} = info;

		for (let i = 0; i < arrOfProps.length; i++) {
			const prop = arrOfProps[i];
			listeners[prop] = listeners[prop] || [];
			for (let i = 0; i < listeners[prop].length; i++) {
				if (listeners[prop][i].fn === listener) {
					listeners[prop].splice(i, 1);
				}
			}
		}
		observedStores.set(store, info);
	}
};

export default MindStore;
