
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

	const sprite1 = await MadDom.createAt(MadDomSprite, canvas);
	await sprite1.setFrames([
		'https://static-cdn.jtvnw.net/jtv_user_pictures/jajav33-profile_image-2e8b93d0ebf04862-70x70.png',
	]);
	sprite1.anchor.x = '-50%';
	sprite1.anchor.y = '-50%';
	sprite1.origin.x = 100;
	sprite1.origin.y = 200;
})()
