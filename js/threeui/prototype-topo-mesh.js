// Prototype 4: "Biomorphic Pore Network & Graph Lattice" (TopoFlow Concept)
// Inspired by ThreeUI "Structure Flow" & "Organic GNN"

import * as THREE from "three";
import { holographicVertexShader, holographicFragmentShader } from "./shaders/holographic.glsl.js";
import { veinVertexShader, veinFragmentShader } from "./shaders/flowVeins.glsl.js";

export function createTopoMeshPrototype(scene) {
  const group = new THREE.Group();
  group.name = "topo-mesh-prototype";

  const nodeCount = 48;
  const nodes = [];
  const clusterCenters = [
    new THREE.Vector3(-2.2, 0.4, 0.5),
    new THREE.Vector3(1.8, -0.6, -0.4),
    new THREE.Vector3(0.0, 1.6, -0.8)
  ];

  // Distribute nodes around 3 cluster centroids
  for (let i = 0; i < nodeCount; i++) {
    const center = clusterCenters[i % clusterCenters.length];
    const pos = new THREE.Vector3(
      center.x + (Math.random() - 0.5) * 3.4,
      center.y + (Math.random() - 0.5) * 2.8,
      center.z + (Math.random() - 0.5) * 3.2
    );
    nodes.push({
      pos,
      basePos: pos.clone(),
      phase: Math.random() * Math.PI * 2,
      scale: 0.18 + Math.random() * 0.42,
      color: [0x00e5ff, 0x47e6a5, 0x7596ff, 0xff8c42][Math.floor(Math.random() * 4)]
    });
  }

  // 1. Instanced Mesh for Pores
  const poreGeo = new THREE.IcosahedronGeometry(1, 2);
  const poreMat = new THREE.MeshPhysicalMaterial({
    roughness: 0.12,
    metalness: 0.65,
    clearcoat: 0.8,
    transmission: 0.45,
    thickness: 0.6,
    transparent: true,
    opacity: 0.85
  });

  const instancedPores = new THREE.InstancedMesh(poreGeo, poreMat, nodeCount);
  const dummy = new THREE.Object3D();

  nodes.forEach((n, idx) => {
    dummy.position.copy(n.pos);
    dummy.scale.setScalar(n.scale);
    dummy.updateMatrix();
    instancedPores.setMatrixAt(idx, dummy.matrix);
    instancedPores.setColorAt(idx, new THREE.Color(n.color));
  });
  instancedPores.instanceMatrix.needsUpdate = true;
  if (instancedPores.instanceColor) instancedPores.instanceColor.needsUpdate = true;
  group.add(instancedPores);

  // 2. Graph Lattice Edges (Tensor Lines)
  const edgeLines = [];
  const edgeTubes = [];

  for (let i = 0; i < nodeCount; i++) {
    for (let j = i + 1; j < nodeCount; j++) {
      const dist = nodes[i].pos.distanceTo(nodes[j].pos);
      if (dist < 2.3 && Math.random() > 0.45) {
        // High-energy laser tube for select edges
        if (Math.random() > 0.65 && edgeTubes.length < 18) {
          const curve = new THREE.LineCurve3(nodes[i].pos, nodes[j].pos);
          const tubeGeo = new THREE.TubeGeometry(curve, 16, 0.02, 6, false);
          const tubeUniforms = {
            uTime: { value: 0 },
            uBaseColor: { value: new THREE.Color(nodes[i].color) },
            uPulseColor: { value: new THREE.Color(0xffffff) },
            uSpeed: { value: 1.5 },
            uFrequency: { value: 2.0 },
            uPulseLength: { value: 0.35 },
            uIntensity: { value: 2.4 }
          };
          const tubeMat = new THREE.ShaderMaterial({
            vertexShader: veinVertexShader,
            fragmentShader: veinFragmentShader,
            uniforms: tubeUniforms,
            transparent: true,
            blending: THREE.AdditiveBlending
          });
          const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
          edgeTubes.push({ mesh: tubeMesh, uniforms: tubeUniforms, i, j });
          group.add(tubeMesh);
        } else {
          edgeLines.push(nodes[i].pos.x, nodes[i].pos.y, nodes[i].pos.z);
          edgeLines.push(nodes[j].pos.x, nodes[j].pos.y, nodes[j].pos.z);
        }
      }
    }
  }

  const linesGeo = new THREE.BufferGeometry();
  linesGeo.setAttribute("position", new THREE.Float32BufferAttribute(edgeLines, 3));
  const linesMat = new THREE.LineBasicMaterial({ color: 0x47e6a5, transparent: true, opacity: 0.35 });
  const networkLines = new THREE.LineSegments(linesGeo, linesMat);
  group.add(networkLines);

  // 3. Volumetric Bounding Hologram Cage
  const cageGeo = new THREE.IcosahedronGeometry(4.8, 1);
  const cageMat = new THREE.ShaderMaterial({
    vertexShader: holographicVertexShader,
    fragmentShader: holographicFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uWarp: { value: 0.25 },
      uColorA: { value: new THREE.Color(0x05131a) },
      uColorB: { value: new THREE.Color(0x0b2830) },
      uAccentColor: { value: new THREE.Color(0x00e5ff) },
      uScanlineDensity: { value: 36.0 },
      uScanlineSpeed: { value: 1.4 },
      uFresnelPower: { value: 2.8 },
      uHoloIntensity: { value: 1.2 },
      uAlpha: { value: 0.3 }
    },
    transparent: true,
    wireframe: true,
    side: THREE.DoubleSide
  });
  const cageMesh = new THREE.Mesh(cageGeo, cageMat);
  group.add(cageMesh);

  scene.add(group);

  return {
    group,
    update(time, pointer) {
      cageMat.uniforms.uTime.value = time;
      edgeTubes.forEach((et) => {
        et.uniforms.uTime.value = time;
      });

      // Organic breathing of nodes
      nodes.forEach((n, idx) => {
        dummy.position.copy(n.basePos);
        dummy.position.y += Math.sin(time * 1.4 + n.phase) * 0.12;
        dummy.position.x += Math.cos(time * 0.9 + n.phase) * 0.08;
        dummy.scale.setScalar(n.scale * (1.0 + Math.sin(time * 2.0 + n.phase) * 0.15));
        dummy.updateMatrix();
        instancedPores.setMatrixAt(idx, dummy.matrix);
      });
      instancedPores.instanceMatrix.needsUpdate = true;

      cageMesh.rotation.y = time * 0.05;
      cageMesh.rotation.z = time * 0.03;

      if (pointer) {
        group.rotation.y = time * 0.06 + pointer.x * 0.35;
        group.rotation.x = -pointer.y * 0.25;
      } else {
        group.rotation.y = time * 0.06;
      }
    },
    destroy() {
      poreGeo.dispose();
      poreMat.dispose();
      linesGeo.dispose();
      linesMat.dispose();
      cageGeo.dispose();
      cageMat.dispose();
      scene.remove(group);
    }
  };
}
