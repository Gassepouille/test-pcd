import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
// import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
// Using a custom outline pass which is the same as the normal outline pass
// but with the blending changed to make the ouline look better when overlapping with the point cloud
import { OutlinePass } from "@/services/CustomOutlinePass.js";

export default class Player {
	constructor(domElement) {
		this._container = domElement;
		// Renderer
		// Ideally, best to have 2 Renderers one for the point cloud and one for the objects in the scene
		// that way, you can render the objects without rendering the point cloud 
		this._renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: true,
			powerPreference: "high-performance",
		});

		this._renderer.setPixelRatio(window.devicePixelRatio);

		this._renderer.domElement.style.position = "absolute";
		this._renderer.domElement.style.top = "0px";
		this._renderer.domElement.style.left = "0px";

		this._container.appendChild(this._renderer.domElement);
		const boundingClientRect = this._container.getBoundingClientRect();
		// Camera + scene
		const _width = boundingClientRect.width;
		const _height = boundingClientRect.height;

		// perspective camera
		this._camera = new THREE.PerspectiveCamera(
			35,
			_width / _height,
			0.01,
			10000,
		);

		this._camera.position.set(4, 4, 4);
		this._camera.lookAt(new THREE.Vector3(0, 0, 0));

		// SCENE
		this._scene = new THREE.Scene();
		this._scene.name = "scene";

		this.onPreRenderFcts = [];
		this.onPostRenderFcts = [];

		//
		this._composer = new EffectComposer(this._renderer);
		this._renderPass = new RenderPass(this._scene, this._camera);
		this._renderPass.clearDepth = false;

		this._outlinePass = new OutlinePass(
			new THREE.Vector2(window.innerWidth, window.innerHeight),
			this._scene,
			this._camera,
		);
		this._outlinePass.edgeStrength = 10;
		this._outlinePass.edgeGlow = 0;
		this._outlinePass.edgeThickness = 1;
		this._outlinePass.visibleEdgeColor.set("#f19e38");
		this._outlinePass.hiddenEdgeColor.set("#f19e38");

		this._composer.addPass(this._renderPass);
		this._composer.addPass(this._outlinePass);

		// resize
		this._onWindowResize();

		// The function loses its context when passed
		// and it needs to be an exact copy to be able to be removed
		this._onWindowResizeCopy = this._onWindowResize.bind(this);
		window.addEventListener("resize", this._onWindowResizeCopy, false);
	}

	get scene() {
		return this._scene;
	}
	get camera() {
		return this._camera;
	}
	get renderersContainer() {
		return this._container;
	}

	render() {
		this.onPreRenderFcts.forEach((onPreRenderFct) => {
			onPreRenderFct();
		});

		this._composer.render();

		this.onPostRenderFcts.forEach((onPostRenderFct) => {
			onPostRenderFct();
		});
	}

	_onWindowResize() {
		const boundingClientRect = this._container.getBoundingClientRect();
		// Camera + scene
		const _width = boundingClientRect.width;
		const _height = boundingClientRect.height;
		this._camera.aspect = _width / _height;
		this._camera.updateProjectionMatrix();

		this._renderer.setSize(_width, _height);
		this._composer.setSize(_width, _height);

		this.render(true);
	}

	outlineObject(object) {
		this._outlinePass.selectedObjects = [object];
	}

	resetOutlineObject() {
		this._outlinePass.selectedObjects = [];
	}

	removeObjectFromScene(object) {
		if (!object) return;
		this._scene.remove(object);
		this._disposeObject(object);
	}

	_disposeObject(object) {
		object.traverse((object3d) => {
			if (object3d.geometry) {
				object3d.geometry.dispose();
				object3d.geometry = undefined;
			}
			if (Array.isArray(object3d.material)) {
				object3d.material.forEach((material) => {
					material.dispose();
					if (material.map) {
						material.map.dispose();
						material.map = undefined;
					}
					material = undefined;
				});
			} else {
				if (object3d.material) {
					object3d.material.dispose();
					if (object3d.material.map) {
						object3d.material.map.dispose();
						object3d.material.map = undefined;
					}
					object3d.material = undefined;
				}
			}
			object3d = undefined;
		});
	}

	destroy() {
		this._composer.dispose();
		this._renderer.forceContextLoss();
		this._renderer.dispose();
		this._renderer = null;

		this._camera = null;
		window.removeEventListener("resize", this._onWindowResizeCopy);
	}
}
