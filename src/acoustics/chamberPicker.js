import * as THREE from "three";
import { findChamberAtPoint } from "./shapeAnalysis.js";

const CHAMBER_COLORS = [
  0xc4a882, 0x7eb8da, 0xa8c878, 0xd4a0c8, 0xe8b86d, 0x8ab4c4, 0xc9a96e, 0x9eb5d4,
];

const POINT_SIZE = 0.14;
const POINT_SIZE_SELECTED = 0.18;

export function createChamberPicker({
  camera,
  domElement,
  scene,
  getMesh,
  getAnalysis,
  onSelect,
  isInteractive = () => true,
}) {
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points = { threshold: 0.2 };
  const pointer = new THREE.Vector2();
  const markers = new THREE.Group();
  markers.name = "chamber-markers";
  scene.add(markers);

  let selectedId = null;
  let interactive = true;

  function clearMarkers() {
    while (markers.children.length) {
      const child = markers.children[0];
      child.geometry?.dispose();
      child.material?.dispose();
      markers.remove(child);
    }
  }

  function createPoint(chamber, { size = POINT_SIZE, opacity = 0.92 } = {}) {
    const color = new THREE.Color(CHAMBER_COLORS[chamber.id % CHAMBER_COLORS.length]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(chamber.position, 3)
    );
    const mat = new THREE.PointsMaterial({
      color,
      size,
      sizeAttenuation: true,
      transparent: true,
      opacity,
      depthTest: false,
      depthWrite: false,
    });
    const point = new THREE.Points(geo, mat);
    point.renderOrder = 999;
    point.userData.chamberId = chamber.id;
    return point;
  }

  function updateFromAnalysis(analysis) {
    clearMarkers();
    selectedId = null;

    if (!analysis?.chambers?.length) return;

    for (const chamber of analysis.chambers) {
      markers.add(createPoint(chamber));
    }
  }

  function highlightChamber(chamberId, analysis) {
    selectedId = chamberId;
    if (chamberId == null || !analysis) return;

    markers.children.forEach((m) => {
      const isSelected = m.userData.chamberId === chamberId;
      m.material.size = isSelected ? POINT_SIZE_SELECTED : POINT_SIZE;
      m.material.opacity = isSelected ? 1 : 0.45;
    });
  }

  function pick(clientX, clientY) {
    const analysis = getAnalysis();
    if (!analysis?.chambers?.length) return null;

    const rect = domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    const mesh = getMesh();
    const hits = [];

    if (mesh) hits.push(...raycaster.intersectObject(mesh, true));
    hits.push(...raycaster.intersectObjects(markers.children, false));

    if (hits.length === 0) return null;

    const hit = hits[0];
    if (hit.object.userData.chamberId != null) {
      return hit.object.userData.chamberId;
    }

    return findChamberAtPoint(hit.point, analysis);
  }

  function onPointerDown(ev) {
    if (ev.button !== 0) return;
    if (!interactive || !isInteractive()) return;
    const id = pick(ev.clientX, ev.clientY);
    if (id == null) return;
    highlightChamber(id, getAnalysis());
    onSelect?.(id);
  }

  function setEnabled(enabled) {
    interactive = !!enabled;
    markers.visible = interactive;
  }

  setEnabled(isInteractive());

  domElement.addEventListener("pointerdown", onPointerDown);

  return {
    updateFromAnalysis,
    highlightChamber,
    setEnabled,
    getSelected: () => selectedId,
    dispose() {
      domElement.removeEventListener("pointerdown", onPointerDown);
      clearMarkers();
      scene.remove(markers);
    },
  };
}
