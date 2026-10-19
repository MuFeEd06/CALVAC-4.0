export async function prepareHeroUpload(file:File):Promise<Blob>{
  const url=URL.createObjectURL(file),image=new Image();
  try{
    image.src=url;await image.decode();
    if(image.width>4096||image.height>4096||image.width*image.height>16000000)throw new Error('Choose an image no larger than 4096 px or 16 megapixels.');
    let scale=Math.min(1,1600/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
    if(!context)throw new Error('Image preparation is unavailable in this browser.');
    for(let pass=0;pass<6;pass++){
      canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
      context.drawImage(image,0,0,canvas.width,canvas.height);
      for(const quality of [.85,.7,.55,.4]){
        const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',quality));
        if(blob&&blob.type==='image/webp'&&blob.size<=200*1024)return blob;
      }
      scale*=.8;
    }
    throw new Error('This image could not fit the 200 KB upload limit. Choose a simpler or smaller image.');
  }finally{URL.revokeObjectURL(url);}
}
