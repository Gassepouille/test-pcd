<template>
	<div class="app-container">
		<div
			class="loading-bar"
			v-if="!hasPointCloudLoaded"
			:style="{ width: pointCloudLoadedPercentage + '%' }"
		></div>
		<div class="player-container"></div>
		<Toolbar
			:hasSelectedObject="hasSelectedObject"
			@onToolSelect="onToolSelect"
			@onToolAddObject="onToolAddObject"
			@onToolTranslate="onToolTranslate"
			@onToolRotate="onToolRotate"
			@onToolScale="onToolScale"
			@onToolDelete="onToolDelete"
		/>
	</div>
</template>

<script>
import Toolbar from "@/components/Toolbar.vue";
import Player from "@/services/Player.js";
import PointerLogic from "@/services/PointerLogic.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PCDLoader } from "three/addons/loaders/PCDLoader.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

// BVH code
import {
	computeBoundsTree,
	disposeBoundsTree,
	acceleratedRaycast,
} from "three-mesh-bvh";
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

let _PLAYER = null;
let _POINTERLOGIC = null;
let _SELECTEDOBJECT = null;
let _TRANSFORMCONTROLS = null;
let _ORBITCONTROLS = null;

export default {
	name: "App",

	components: {
		Toolbar,
	},

	data() {
		return {
			pointCloudLoadedPercentage: 0,
			hasPointCloudLoaded: false,
			toolActive: null,
			hasSelectedObject: false,
		};
	},

	mounted() {
		console.log("App Mounted");
		this.initEditor();
	},

	methods: {
		// TOOLS
		onToolSelect() {
			this.toolActive = "select";
		},
		onToolAddObject() {
			this.toolActive = "addObject";
		},
		onToolTranslate() {
			_TRANSFORMCONTROLS.visible = true;
			_TRANSFORMCONTROLS.setMode("translate");
			_PLAYER.render();
		},
		onToolRotate() {
			_TRANSFORMCONTROLS.visible = true;
			_TRANSFORMCONTROLS.setMode("rotate");
			_PLAYER.render();
		},
		onToolScale() {
			_TRANSFORMCONTROLS.visible = true;
			_TRANSFORMCONTROLS.setMode("scale");
			_PLAYER.render();
		},
		onToolDelete() {
			const temporaryObjectReference = _SELECTEDOBJECT;
			_PLAYER.removeObjectFromScene(temporaryObjectReference);
			this.unselectObject();
			_PLAYER.render();
		},

		// Players/editor
		initEditor() {
			// INIT PLAYER
			const playerContainer = document.querySelector(".player-container");
			_PLAYER = new Player(playerContainer);

			// ADD CONTROLS
			_ORBITCONTROLS = new OrbitControls(
				_PLAYER.camera,
				_PLAYER.renderersContainer,
			);
			_ORBITCONTROLS.addEventListener("change", () => {
				_PLAYER.render();
			});

			// init pointerLogic
			this.initPointerLogic();

			// ADD GRID HELPER
			this.addGridHelper();

			// load point cloud
			this.loadPointCloud();

			// TransformControls
			this.initTransformControls();

			// Render scene first time
			_PLAYER.render();
		},

		addGridHelper() {
			const gridHelper = new THREE.GridHelper(10, 10, 0xf19e38, 0x808080);
			gridHelper.userData.selectable = false;
			_PLAYER.scene.add(gridHelper);
		},
		// LOAD POINT CLOUD
		loadPointCloud() {
			const loader = new PCDLoader();
			loader.load(
				"https://segmentsai-prod.s3.eu-west-2.amazonaws.com/assets/admin-tobias/41089c53-efca-4634-a92a-0c4143092374.pcd",
				(points) => {
					points.userData.isPointCloud = true;
					points.material.size = 0.1;
					// ---- BVH Code to improve performances when doing raytracing on large point clouds
					const indices = [];
					const bvhGeometry = points.geometry.clone();
					let verticesLength = bvhGeometry.attributes.position.count;
					for (let i = 0, l = verticesLength; i < l; i++) {
						indices.push(i, i, i);
					}
					bvhGeometry.setIndex(indices);
					const bvhMaterial = new THREE.MeshBasicMaterial({
						color: 0xff0000,
					});
					const bvhMesh = new THREE.Mesh(bvhGeometry, bvhMaterial);
					bvhMesh.visible = false;
					bvhMesh.userData.isBVH = true;
					bvhMesh.userData.selectable = false;

					console.time("BVH:computeBoundsTree");
					bvhMesh.geometry.computeBoundsTree();
					console.timeEnd("BVH:computeBoundsTree");

					points.add(bvhMesh);
					// ---- BVH Code

					_PLAYER.scene.add(points);
					this.hasPointCloudLoaded = true;
					// Render scene when loaded
					_PLAYER.render();
				},
				(xhr) => {
					this.pointCloudLoadedPercentage = Math.round(
						(xhr.loaded / xhr.total) * 100,
					);
				},
			);
		},

		initPointerLogic() {
			// POINT SIZE * SCALE 0.1 * 0.05
			_POINTERLOGIC = new PointerLogic(
				_PLAYER.camera,
				_PLAYER.renderersContainer,
			);

			_POINTERLOGIC.addScene(_PLAYER.scene);

			const playerContainer = document.querySelector(".player-container");
			_POINTERLOGIC.onHover = (intersect) => {
				if (intersect) {
					if (this.toolActive === "addObject") {
						playerContainer.classList.add("hover-object-add");
					} else if (this.toolActive === "select") {
						if (!intersect.object.userData.isPointCloud) {
							playerContainer.classList.add(
								"hover-object-select",
							);
						} else {
							playerContainer.classList.remove(
								"hover-object-select",
							);
						}
					}
				} else {
					playerContainer.classList.remove("hover-object-add");
					playerContainer.classList.remove("hover-object-select");
				}
			};
			_POINTERLOGIC.onPick = (intersect) => {
				if (intersect) {
					if (this.toolActive === "addObject") {
						this.createBox(intersect.point);
					} else if (
						this.toolActive === "select" &&
						!intersect.object.userData.isPointCloud
					) {
						this.selectObject(intersect.object);
					}
				} else {
					this.unselectObject();
				}
			};
		},

		initTransformControls() {
			_TRANSFORMCONTROLS = new TransformControls(
				_PLAYER.camera,
				_PLAYER.renderersContainer,
			);
			_TRANSFORMCONTROLS.traverse(
				(object3D) => (object3D.userData.selectable = false),
			);
			_TRANSFORMCONTROLS.userData.selectable = false;
			_TRANSFORMCONTROLS.addEventListener("change", () => {
				_PLAYER.render();
			});

			_TRANSFORMCONTROLS.addEventListener("dragging-changed", (event) => {
				_ORBITCONTROLS.enabled = !event.value;
			});

			_PLAYER.scene.add(_TRANSFORMCONTROLS);
		},
		createBox(position) {
			const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
			const material = new THREE.MeshBasicMaterial({
				color: Math.random() * 0xffffff,
			});
			const cube = new THREE.Mesh(geometry, material);
			cube.position.copy(position);
			_PLAYER.scene.add(cube);
			_PLAYER.render();
		},
		selectObject(object3D) {
			this.hasSelectedObject = true;
			_SELECTEDOBJECT = object3D;
			_TRANSFORMCONTROLS.attach(_SELECTEDOBJECT);
			_TRANSFORMCONTROLS.visible = false;
			_PLAYER.outlineObject(_SELECTEDOBJECT);
			_PLAYER.render();
		},
		unselectObject() {
			_TRANSFORMCONTROLS.visible = false;
			_TRANSFORMCONTROLS.detach(_SELECTEDOBJECT);
			this.hasSelectedObject = false;
			_SELECTEDOBJECT = null;
			_PLAYER.resetOutlineObject();
			_PLAYER.render();
		},
	},
	unmounted() {
		_PLAYER.destroy();
		_PLAYER = null;
		_POINTERLOGIC = null;
		_TRANSFORMCONTROLS = null;
	},
};
</script>

<style lang="scss" scoped>
.app-container,
.player-container {
	width: 100%;
	height: 100%;
}

.app-container {
	position: relative;
}

.player-container {
	&.hover-object-add {
		cursor: copy;
	}

	&.hover-object-select {
		cursor: pointer;
	}
}

.loading-bar {
	position: absolute;
	height: 5px;
	background-color: #00f;
	top: 0px;
	left: 0px;
	z-index: 10;
}
</style>
