import {AmbientLight,Box3,DirectionalLight,Group,HemisphereLight,OrthographicCamera,Scene,Vector3,WebGLRenderer,SRGBColorSpace,ACESFilmicToneMapping,Mesh,Texture,Material} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

function releaseObject(object:Group) {
  object.traverse(node=>{
    if(!(node instanceof Mesh))return;
    node.geometry.dispose();
    const materials:Material[]=Array.isArray(node.material)?node.material:[node.material];
    for(const material of materials){for(const value of Object.values(material))if(value instanceof Texture){value.dispose();const data=value.source?.data;if(typeof ImageBitmap!=='undefined'&&data instanceof ImageBitmap)data.close();}material.dispose();}
  });
}

export async function mountCharacter(host:HTMLElement,signal:AbortSignal,capture=false) {
  const renderer=new WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:capture});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  const scene=new Scene(),camera=new OrthographicCamera(-.12,.12,.13,-.13,.01,10);
  camera.position.set(0,.015,1);camera.lookAt(0,0,0);
  scene.add(new HemisphereLight(0xffffff,0x8b8275,2.2));scene.add(new AmbientLight(0xffffff,.8));
  const key=new DirectionalLight(0xffffff,2.8);key.position.set(1,1,2);scene.add(key);
  const fill=new DirectionalLight(0xe5edff,1.3);fill.position.set(-1,.5,1);scene.add(fill);
  const group=new Group();scene.add(group);let disposed=false,frame=0,visible=true,until=0,target=0;
  const finish=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();document.removeEventListener('visibilitychange',visibility);renderer.domElement.removeEventListener('webglcontextlost',finish);signal.removeEventListener('abort',finish);delete host.dataset.ready;releaseObject(group);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
  const draw=()=>{frame=0;if(disposed||!visible||document.hidden)return;const now=performance.now(),moving=now<until;
    group.rotation.y+=(target-group.rotation.y)*.14;group.position.y=moving?Math.sin(now*.005)*.003:0;
    renderer.render(scene,camera);if(moving||Math.abs(target-group.rotation.y)>.001)frame=requestAnimationFrame(draw);
  };
  const wake=()=>{if(!disposed&&!frame&&visible&&!document.hidden)frame=requestAnimationFrame(draw);};
  const resize=new ResizeObserver(()=>{if(disposed)return;const {width,height}=host.getBoundingClientRect();if(width&&height){renderer.setSize(width,height,false);const aspect=width/height;camera.left=-.125*aspect;camera.right=.125*aspect;camera.updateProjectionMatrix();wake();}});
  const observer=new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);if(visible)wake();else{cancelAnimationFrame(frame);frame=0;}});
  const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else wake();};
  signal.addEventListener('abort',finish,{once:true});
  renderer.domElement.addEventListener('webglcontextlost',finish,{once:true});
  try{
    const response=await fetch('/companion/character-v1.glb',{signal});if(!response.ok)throw new Error('Character unavailable');
    const gltf=await new GLTFLoader().parseAsync(await response.arrayBuffer(),'/companion/');
    if(signal.aborted||disposed){releaseObject(gltf.scene);throw new DOMException('Aborted','AbortError');}
    let textured=false;gltf.scene.traverse(node=>{if(node instanceof Mesh){const materials=Array.isArray(node.material)?node.material:[node.material];if(materials.some(material=>material.map))textured=true;}});
    if(!textured){releaseObject(gltf.scene);throw new Error('Character texture unavailable');}
    const bounds=new Box3().setFromObject(gltf.scene),center=bounds.getCenter(new Vector3()),size=bounds.getSize(new Vector3());
    gltf.scene.position.sub(center);const scale=.2/Math.max(size.y,.01);group.add(gltf.scene);group.scale.setScalar(scale);
    host.appendChild(renderer.domElement);resize.observe(host);observer.observe(host);document.addEventListener('visibilitychange',visibility);host.dataset.ready='true';wake();
    return {dispose:finish,pulse:()=>{until=performance.now()+1800;target=.1;wake();},look:(x:number)=>{target=Math.max(-.25,Math.min(.25,x));wake();},snapshot:()=>{renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');}};
  }catch(error){finish();throw error;}
}
