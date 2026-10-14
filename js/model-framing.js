import * as THREE from '../assets/vendor/three.module.min.js';

// Refit the complete model after a portrait/desktop resize. Ambient particles
// decorate the surrounding space and must not force the subject into the distance.
export function fitModelCamera(camera, subject, direction, margin = .82) {
  subject.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3();
  subject.traverse(object => {
    if (!object.geometry || object.isPoints) return;
    if (object.isInstancedMesh) object.computeBoundingBox();
    else if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    const box = (object.isInstancedMesh ? object.boundingBox : object.geometry.boundingBox)?.clone();
    if (box) bounds.union(box.applyMatrix4(object.matrixWorld));
  });
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const outward = direction.clone().normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), outward).normalize();
  const up = new THREE.Vector3().crossVectors(outward, right);
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  let distance = 0;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const relative = new THREE.Vector3(x, y, z).sub(center);
    const depth = relative.dot(outward);
    distance = Math.max(distance, Math.abs(relative.dot(right)) / (tan * camera.aspect * margin) + depth,
      Math.abs(relative.dot(up)) / (tan * margin) + depth);
  }
  camera.position.copy(center).addScaledVector(outward, distance);
  camera.far = Math.max(100, distance + bounds.getSize(new THREE.Vector3()).length() * 2);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}
