import * as THREE from "three";
import { INTERSECTED, NOT_INTERSECTED } from "three-mesh-bvh";

export default class PointerLogic {
	constructor(camera, domElement) {
		this._onHover = null;
		this._onPick = null;
		this._camera = camera;
		this._domElement = domElement;
		this._scene = null;

		this._clickableElements = [];
		this._pointerDownPosition = null;
		this._pointerUpPosition = null;
		this._pointerTarget = null;

		this._raycaster = new THREE.Raycaster();
		this._raycaster.firstHitOnly = true;
		// POINT SIZE and POINT CLOUD SCALE
		this._raycaster.params.Points.threshold = 0.1 * 0.05;

		// Copy of mouseup because the binding return a new different function each time called
		// therefore removeeventlistener won't work
		this._onPointerMoveCopy = this._onPointerMove.bind(this);
		this._domElement.addEventListener(
			"pointermove",
			this._onPointerMoveCopy,
			false,
		);

		this._onPointerDownCopy = this._onPointerDown.bind(this);
		this._domElement.addEventListener(
			"pointerdown",
			this._onPointerDownCopy,
			false,
		);
		this._onPointerUpCopy = this._onPointerUp.bind(this);
	}

	set onHover(callback) {
		this._onHover = callback;
	}

	set onPick(callback) {
		this._onPick = callback;
	}

	addScene(sceneToAdd) {
		this._scene = sceneToAdd;
	}
	removeScene() {
		this._scene = null;
	}

	_onPointerDown(pointerEvent) {
		pointerEvent.preventDefault();
		this._pointerDownPosition = this._getPointer3DPosition(pointerEvent);

		this._domElement.addEventListener(
			"pointerup",
			this._onPointerUpCopy,
			false,
		);
	}

	_onPointerUp(pointerEvent) {
		pointerEvent.preventDefault();
		if (!this._onPick) return;

		this._pointerUpPosition = this._getPointer3DPosition(pointerEvent);

		if (
			this._pointerDownPosition.distanceTo(this._pointerUpPosition) === 0
		) {
			const _pointerPosition = this._pointerUpPosition.clone();
			this._pick(_pointerPosition);
			this._onPick(this._pointerTarget);
		}

		this._domElement.removeEventListener(
			"pointerup",
			this._onPointerUpCopy,
			false,
		);
	}

	_onPointerMove(pointerEvent) {
		if (!this._onHover) return;
		if (!this._scene) {
			this._pointerTarget = null;
			this._onHover(this._pointerTarget);
			return;
		}

		const _pointerPosition = this._getPointer3DPosition(pointerEvent);
		this._pick(_pointerPosition);

		this._onHover(this._pointerTarget);
	}

	_pick(_pointerPosition) {
		this._setClickableElements();

		this._raycaster.setFromCamera(_pointerPosition, this._camera);

		let objectPicked = this._pickScene();
		if (!objectPicked) {
			objectPicked = this._pickPointCloud();
		}

		if (objectPicked && objectPicked.object.userData.selectParent) {
			objectPicked.object = objectPicked.object.userData.selectParent;
		}

		this._pointerTarget = objectPicked ? objectPicked : null;
	}

	_pickScene() {
		const _sceneObjects = this._clickableElements.filter(
			(object) => object.userData.isPointCloud !== true,
		);

		const intersects = this._raycaster.intersectObjects(_sceneObjects);
		return intersects.length > 0 ? intersects[0] : false;
	}

	_pickPointCloud() {
		const pointCloud = this._clickableElements.find(
			(object) => object.userData.isPointCloud === true,
		);

		if (!pointCloud) return false;

		let pointCloudBVH = null;
		pointCloud.traverse((object3D) => {
			if (object3D.userData.isBVH) pointCloudBVH = object3D;
		});

		if (!pointCloudBVH) return false;

		const inverseMatrix = new THREE.Matrix4();
		inverseMatrix.copy(pointCloudBVH.matrixWorld).invert();
		this._raycaster.ray.applyMatrix4(inverseMatrix);

		let closestDistance = Infinity;
		let intersectedPoint = null;

		let pointScale = pointCloud.material.size / window.devicePixelRatio;

		// Cap the selection area for the points to avoid hard selection
		pointScale = Math.max(pointScale, 0.007);

		// Depending on which pointcloud is scaled,
		//but we'll say that the BVH model is untouched and that the one that scales is the parent
		const localThreshold =
			pointScale /
			((pointCloud.scale.x + pointCloud.scale.y + pointCloud.scale.z) /
				3);
		const localThresholdSq = localThreshold * localThreshold;

		pointCloudBVH.geometry.boundsTree.shapecast({
			boundsTraverseOrder: (box) => {
				// traverse the closer bounds first.
				return box.distanceToPoint(this._raycaster.ray.origin);
			},
			intersectsBounds: (box, isLeaf, score) => {
				// if we've already found a point that's closer than the full bounds then
				// don't traverse further.
				if (score > closestDistance) return NOT_INTERSECTED;
				box.expandByScalar(localThreshold);
				return this._raycaster.ray.intersectsBox(box)
					? INTERSECTED
					: NOT_INTERSECTED;
			},
			intersectsTriangle: (triangle) => {
				const distancesToRaySq = this._raycaster.ray.distanceSqToPoint(
					triangle.a,
				);
				if (distancesToRaySq < localThresholdSq) {
					// track the closest found point distance so we can early out traversal and only
					// use the closest point along the ray.
					const distanceToPoint =
						this._raycaster.ray.origin.distanceTo(triangle.a);
					if (distanceToPoint < closestDistance) {
						closestDistance = distanceToPoint;
						intersectedPoint = {
							object: pointCloud,
							point: triangle.a
								.clone()
								.applyMatrix4(pointCloudBVH.matrixWorld),
						};
					}
				}
			},
		});

		if (intersectedPoint !== null) return intersectedPoint;

		return false;
	}

	_getPointer3DPosition(pointerEvent) {
		const _pointerPosition = new THREE.Vector2();
		const boundingRectangle = this._domElement.getBoundingClientRect();
		_pointerPosition.x =
			((pointerEvent.clientX - boundingRectangle.left) /
				boundingRectangle.width) *
				2 -
			1;
		_pointerPosition.y =
			-(
				(pointerEvent.clientY - boundingRectangle.top) /
				boundingRectangle.height
			) *
				2 +
			1;

		return _pointerPosition;
	}

	_setClickableElements() {
		this._clickableElements = [];
		this._scene.traverseVisible((object3D) => {
			if (object3D.type === "Scene") return;
			if (object3D.userData.selectable === false) return;
			this._clickableElements.push(object3D);
		});
	}

	destroy() {
		this._domElement.removeEventListener(
			"pointermove",
			this._onPointerMoveCopy,
			false,
		);

		this._domElement.removeEventListener(
			"pointerdown",
			this._onPointerDownCopy,
			false,
		);

		this._pointerTarget = null;
		this._onHover = null;
		this._onPick = null;
		this._camera = null;
		this._domElement = null;
		this._scene = null;
		this._clickableElements = null;
		this._pointerDownPosition = null;
		this._pointerUpPosition = null;
		this._onPointerMoveCopy = null;
		this._onPointerDownCopy = null;
		this._onPointerUpCopy = null;
		this._raycaster = null;
	}
}
