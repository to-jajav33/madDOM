
import MadDom from './libs/madDOM/MadDOM.js';

(async () => {
	const canvas = document.body.querySelector('#canvas');
	/** @type {import('./libs/madDOM/MadDomSprite.js').MadDomSprite} */
	const MadDomSprite = await MadDom.MadDomSprite;

	const sprite = await MadDom.createAt(MadDomSprite, canvas);
	await sprite.setFrames([
		'https://static-cdn.jtvnw.net/jtv_user_pictures/jajav33-profile_image-2e8b93d0ebf04862-70x70.png',
	]);
	sprite.anchor.x = '-50%';
	sprite.origin.x = '100px';
	sprite.mind.style.background = 'red';
})()
