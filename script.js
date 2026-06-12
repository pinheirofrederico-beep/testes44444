// Carregar personagem humano
const loader = new THREE.GLTFLoader();
loader.load("modelos/personagem.glb", function(gltf){
  player = gltf.scene;
  player.scale.set(1,1,1);
  player.position.set(0,1,0);
  scene.add(player);
});

// Carregar cenário urbano
loader.load("modelos/cidade.glb", function(gltf){
  const cidade = gltf.scene;
  cidade.scale.set(10,10,10);
  scene.add(cidade);
});




const mixer = new THREE.AnimationMixer(player);
gltf.animations.forEach((clip) => {
  mixer.clipAction(clip).play();
});

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  mixer.update(delta);
  renderer.render(scene, camera);
}
