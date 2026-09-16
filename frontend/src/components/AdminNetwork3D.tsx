import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface AdminNetworkTeacher {
  id: string;
  name: string;
  department: string;
  email: string;
  role: string;
}

export interface AdminNetworkClass {
  id: string;
  name: string;
  teacher: { name: string; email: string };
  _count: { enrollments: number; polls: number };
}

interface AdminNetwork3DProps {
  teachers: AdminNetworkTeacher[];
  classes: AdminNetworkClass[];
  selectedTeacherId: string | null;
  onSelectTeacher: (teacherId: string) => void;
}

function makeLabel(text: string, color: string) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  context.font = "600 24px sans-serif";
  const width = Math.max(120, context.measureText(text).width + 28);
  canvas.width = width * 2;
  canvas.height = 64;
  context.scale(2, 2);
  context.font = "600 24px sans-serif";
  context.fillStyle = "rgba(15, 23, 42, 0.88)";
  context.roundRect(0, 0, width, 32, 8);
  context.fill();
  context.fillStyle = color;
  context.fillText(text, 14, 23);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(width / 80, 0.4, 1);
  return sprite;
}

export default function AdminNetwork3D({ teachers, classes, selectedTeacherId, onSelectTeacher }: AdminNetwork3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelectTeacher);
  onSelectRef.current = onSelectTeacher;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const container = mount;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#081426");
    scene.fog = new THREE.Fog("#081426", 18, 34);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 7.5, 15);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 1, 0);
    controls.minDistance = 7;
    controls.maxDistance = 24;
    controls.maxPolarAngle = Math.PI / 2.05;

    scene.add(new THREE.HemisphereLight("#dbeafe", "#0f172a", 2.4));
    const keyLight = new THREE.DirectionalLight("#67e8f9", 3);
    keyLight.position.set(-6, 10, 8);
    scene.add(keyLight);
    const grid = new THREE.GridHelper(24, 24, "#1e4b68", "#153047");
    grid.position.y = -1.1;
    scene.add(grid);

    const teacherGroup = new THREE.Group();
    const classGroup = new THREE.Group();
    scene.add(teacherGroup, classGroup);
    const clickable: THREE.Object3D[] = [];
    const teacherPositions = new Map<string, THREE.Vector3>();
    const spacing = Math.max(3.5, Math.min(5.5, 18 / Math.max(teachers.length, 1)));
    const startX = ((teachers.length - 1) * spacing) / -2;

    teachers.forEach((teacher, index) => {
      const position = new THREE.Vector3(startX + index * spacing, 1.7, 0);
      teacherPositions.set(teacher.id, position);
      const selected = teacher.id === selectedTeacherId;
      const material = new THREE.MeshStandardMaterial({ color: selected ? "#fbbf24" : "#38bdf8", emissive: selected ? "#713f12" : "#075985", emissiveIntensity: 0.8, metalness: 0.35, roughness: 0.28 });
      const node = new THREE.Mesh(new THREE.IcosahedronGeometry(selected ? 1.05 : 0.86, 2), material);
      node.position.copy(position);
      node.userData.teacherId = teacher.id;
      teacherGroup.add(node);
      clickable.push(node);
      const label = makeLabel(teacher.name, selected ? "#fcd34d" : "#bae6fd");
      label.position.set(position.x, position.y + 1.45, position.z);
      teacherGroup.add(label);

      classes.filter((item) => item.teacher.name === teacher.name).forEach((item, classIndex) => {
        const classPosition = new THREE.Vector3(position.x + (classIndex - 0.5) * 1.35, -0.05, 1.4 + classIndex * 0.25);
        const classMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.65, 0.9), new THREE.MeshStandardMaterial({ color: "#f97316", emissive: "#7c2d12", emissiveIntensity: 0.35, roughness: 0.45 }));
        classMesh.position.copy(classPosition);
        classGroup.add(classMesh);
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([position, classPosition]), new THREE.LineBasicMaterial({ color: "#38bdf8", transparent: true, opacity: 0.48 }));
        classGroup.add(line);
        const classLabel = makeLabel(item.name, "#fed7aa");
        classLabel.position.set(classPosition.x, classPosition.y + 0.8, classPosition.z);
        classGroup.add(classLabel);
      });
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    function handleClick(event: PointerEvent) {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(clickable)[0];
      if (hit?.object.userData.teacherId) onSelectRef.current(hit.object.userData.teacherId);
    }
    renderer.domElement.addEventListener("pointerup", handleClick);

    function resize() {
      const width = container.clientWidth;
      const height = Math.max(360, Math.min(520, Math.round(width * 0.58)));
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    let frame = 0;
    function animate() {
      frame = requestAnimationFrame(animate);
      teacherGroup.rotation.y += 0.0008;
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerup", handleClick);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose()); else object.material.dispose();
        }
      });
    };
  }, [classes, selectedTeacherId, teachers]);

  return <div ref={mountRef} className="min-h-[360px] w-full overflow-hidden rounded-xl" aria-label="3D teacher and class network" />;
}
