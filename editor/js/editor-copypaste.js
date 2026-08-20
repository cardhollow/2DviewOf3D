(function(){
"use strict";

var internalClipboard=null;
var MAGIC_0=0x50;
var MAGIC_1=0x4F;
var MAGIC_2=0x42;
var MAGIC_3=0x43;
var VERSION=2;

function BinaryWriter(){
    this.data=[];
}

BinaryWriter.prototype.writeUint8=function(value){
    this.data.push(Number(value)&255);
};

BinaryWriter.prototype.writeUint32=function(value){
    value=Number(value)>>>0;
    this.data.push(value&255,(value>>>8)&255,(value>>>16)&255,(value>>>24)&255);
};

BinaryWriter.prototype.writeFloat32=function(value){
    var buffer=new ArrayBuffer(4);
    var view=new DataView(buffer);
    view.setFloat32(0,Number(value)||0,true);
    var bytes=new Uint8Array(buffer);
    this.data.push(bytes[0],bytes[1],bytes[2],bytes[3]);
};

BinaryWriter.prototype.writeString=function(value){
    var bytes=new TextEncoder().encode(String(value||""));
    this.writeUint32(bytes.length);
    for(var i=0;i<bytes.length;i++)this.data.push(bytes[i]);
};

BinaryWriter.prototype.toUint8Array=function(){
    return new Uint8Array(this.data);
};

function BinaryReader(buffer){
    this.bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
    this.offset=0;
}

BinaryReader.prototype.ensure=function(amount){
    if(this.offset+amount>this.bytes.length){
        throw new Error("Invalid clipboard data");
    }
};

BinaryReader.prototype.readUint8=function(){
    this.ensure(1);
    return this.bytes[this.offset++];
};

BinaryReader.prototype.readUint32=function(){
    this.ensure(4);
    var value=this.bytes[this.offset]|(this.bytes[this.offset+1]<<8)|(this.bytes[this.offset+2]<<16)|(this.bytes[this.offset+3]<<24);
    this.offset+=4;
    return value>>>0;
};

BinaryReader.prototype.readFloat32=function(){
    this.ensure(4);
    var buffer=new ArrayBuffer(4);
    var bytes=new Uint8Array(buffer);
    bytes[0]=this.bytes[this.offset];
    bytes[1]=this.bytes[this.offset+1];
    bytes[2]=this.bytes[this.offset+2];
    bytes[3]=this.bytes[this.offset+3];
    this.offset+=4;
    return new DataView(buffer).getFloat32(0,true);
};

BinaryReader.prototype.readString=function(){
    var length=this.readUint32();
    this.ensure(length);
    var bytes=this.bytes.slice(this.offset,this.offset+length);
    this.offset+=length;
    return new TextDecoder().decode(bytes);
};

function writeVector3(writer,v){
    writer.writeFloat32(v.x);
    writer.writeFloat32(v.y);
    writer.writeFloat32(v.z);
}

function readVector3(reader){
    return new THREE.Vector3(
        reader.readFloat32(),
        reader.readFloat32(),
        reader.readFloat32()
    );
}

function getTags(object){
    return object.userData&&Array.isArray(object.userData.tags)?object.userData.tags:[];
}

function getColor(object){
    if(object.material&&object.material.color){
        return object.material.color.getHex();
    }
    return 0xFFFFFF;
}

function getMaterialData(object){
    var material=object.material;

    if(!material){
        return {
            color:0xFFFFFF,
            opacity:1,
            transparent:false,
            wireframe:false,
            visible:true
        };
    }

    return {
        color:material.color?material.color.getHex():0xFFFFFF,
        opacity:typeof material.opacity==="number"?material.opacity:1,
        transparent:!!material.transparent,
        wireframe:!!material.wireframe,
        visible:material.visible!==false
    };
}

function writeGeometry(writer,geometry){
    if(!geometry){
        writer.writeUint32(0);
        writer.writeUint32(0);
        return;
    }

    if(!geometry.vertices||!geometry.faces){
        throw new Error("Selected object geometry is not THREE.Geometry");
    }

    writer.writeUint32(geometry.vertices.length);

    for(var i=0;i<geometry.vertices.length;i++){
        writeVector3(writer,geometry.vertices[i]);
    }

    writer.writeUint32(geometry.faces.length);

    for(var f=0;f<geometry.faces.length;f++){
        var face=geometry.faces[f];
        writer.writeUint32(face.a);
        writer.writeUint32(face.b);
        writer.writeUint32(face.c);
    }
}

function readGeometry(reader){
    var geometry=new THREE.Geometry();
    var vertexCount=reader.readUint32();

    for(var i=0;i<vertexCount;i++){
        geometry.vertices.push(readVector3(reader));
    }

    var faceCount=reader.readUint32();

    for(var f=0;f<faceCount;f++){
        geometry.faces.push(
            new THREE.Face3(
                reader.readUint32(),
                reader.readUint32(),
                reader.readUint32()
            )
        );
    }

    if(geometry.computeFaceNormals){
        geometry.computeFaceNormals();
    }

    if(geometry.computeVertexNormals){
        geometry.computeVertexNormals();
    }

    if(geometry.computeBoundingBox){
        geometry.computeBoundingBox();
    }

    if(geometry.computeBoundingSphere){
        geometry.computeBoundingSphere();
    }

    return geometry;
}

function encodeObjects(objects){
    var writer=new BinaryWriter();

    writer.writeUint8(MAGIC_0);
    writer.writeUint8(MAGIC_1);
    writer.writeUint8(MAGIC_2);
    writer.writeUint8(MAGIC_3);
    writer.writeUint8(VERSION);
    writer.writeUint32(objects.length);

    for(var i=0;i<objects.length;i++){
        var object=objects[i];

        writer.writeString(object.name||"Object");
        writer.writeString(object.userData&&object.userData.type?object.userData.type:"object");

        var tags=getTags(object);

        writer.writeUint32(tags.length);

        for(var t=0;t<tags.length;t++){
            writer.writeString(tags[t]);
        }

        writeVector3(writer,object.position);

        writer.writeFloat32(object.rotation.x);
        writer.writeFloat32(object.rotation.y);
        writer.writeFloat32(object.rotation.z);
        writer.writeFloat32(object.rotation.order==="XYZ"?0:0);

        writeVector3(writer,object.scale);

        var material=getMaterialData(object);

        writer.writeUint32(material.color);
        writer.writeFloat32(material.opacity);
        writer.writeUint8(material.transparent?1:0);
        writer.writeUint8(material.wireframe?1:0);
        writer.writeUint8(material.visible?1:0);

        writeGeometry(writer,object.geometry);
    }

    return writer.toUint8Array();
}

function decodeObjects(binary){
    var reader=new BinaryReader(binary);

    if(reader.readUint8()!==MAGIC_0||reader.readUint8()!==MAGIC_1||reader.readUint8()!==MAGIC_2||reader.readUint8()!==MAGIC_3){
        throw new Error("Invalid editor clipboard");
    }

    if(reader.readUint8()!==VERSION){
        throw new Error("Unsupported clipboard version");
    }

    var count=reader.readUint32();
    var objects=[];

    for(var i=0;i<count;i++){
        var name=reader.readString();
        var type=reader.readString();

        var tagCount=reader.readUint32();
        var tags=[];

        for(var t=0;t<tagCount;t++){
            tags.push(reader.readString());
        }

        var position=readVector3(reader);

        var rotation=new THREE.Euler(
            reader.readFloat32(),
            reader.readFloat32(),
            reader.readFloat32()
        );

        reader.readFloat32();

        var scale=readVector3(reader);

        var material={
            color:reader.readUint32(),
            opacity:reader.readFloat32(),
            transparent:!!reader.readUint8(),
            wireframe:!!reader.readUint8(),
            visible:!!reader.readUint8()
        };

        objects.push({
            name:name,
            type:type,
            tags:tags,
            position:position,
            rotation:rotation,
            scale:scale,
            material:material,
            geometry:readGeometry(reader)
        });
    }

    return objects;
}

function createClipboardObject(data){
    var material;

    if(typeof createMaterial==="function"){
        material=createMaterial("#"+data.material.color.toString(16).padStart(6,"0"));
    }else{
        material=new THREE.MeshBasicMaterial({
            color:data.material.color
        });
    }

    if(!material){
        material=new THREE.MeshBasicMaterial({
            color:data.material.color
        });
    }

    if(material.color){
        material.color.setHex(data.material.color);
    }

    material.opacity=data.material.opacity;
    material.transparent=data.material.transparent;
    material.wireframe=data.material.wireframe;
    material.visible=data.material.visible;

    var object=new THREE.Mesh(data.geometry,material);

    object.name=data.name+"_Copy";
    object.position.copy(data.position);
    object.rotation.copy(data.rotation);
    object.scale.copy(data.scale);

    object.userData={
        editorObject:true,
        type:data.type,
        tags:data.tags.slice()
    };

    return object;
}

function copySelectedObjects(){
    if(typeof selectedObjects==="undefined"||!selectedObjects.length){
        if(typeof statusElement!=="undefined"){
            statusElement.textContent="Nothing selected to copy";
        }
        return;
    }

    try{
        internalClipboard=encodeObjects(selectedObjects);

        if(typeof statusElement!=="undefined"){
            statusElement.textContent=selectedObjects.length+" object"+(selectedObjects.length===1?"":"s")+" copied";
        }
    }catch(error){
        console.error("Copy objects error:",error);

        if(typeof statusElement!=="undefined"){
            statusElement.textContent="Copy failed";
        }
    }
}

function pasteClipboardObjects(){
    if(!internalClipboard){
        if(typeof statusElement!=="undefined"){
            statusElement.textContent="Nothing to paste";
        }
        return;
    }

    try{
        var data=decodeObjects(internalClipboard);

        if(!data.length)return;

        var before=serializeScene();
        var pasted=[];

        for(var i=0;i<data.length;i++){
            var object=createClipboardObject(data[i]);

            object.position.x+=1;
            object.userData.editorObject=true;

            scene.add(object);
            objectCounter++;
            pasted.push(object);
        }

        setSelectedObjects(pasted,pasted[pasted.length-1]);
        selectionAnchor=pasted[pasted.length-1];

        recordModification(before);
        saveLocal();

        statusElement.textContent=data.length+" object"+(data.length===1?"":"s")+" pasted";
    }catch(error){
        console.error("Paste objects error:",error);

        statusElement.textContent="Paste failed";

        alert("Could not paste objects:\n"+error.message);
    }
}

function isTypingTarget(target){
    if(!target){
        return false;
    }

    var tag=String(target.tagName||"").toLowerCase();

    if(tag==="input"||tag==="textarea"||tag==="select"||tag==="option"||target.isContentEditable){
        return true;
    }

    if(typeof target.closest==="function"&&target.closest("input,textarea,select,[contenteditable='true']")){
        return true;
    }

    return false;
}

function handleCopyPasteKeyDown(event){
    if(isTypingTarget(event.target)){
        return;
    }

    if(!(event.ctrlKey||event.metaKey)){
        return;
    }

    var hasSelection=typeof selectedObjects!=="undefined"&&selectedObjects.length>0;

    if(!hasSelection){
        return;
    }

    var key=String(event.key||"").toLowerCase();

    if(key==="c"){
        event.preventDefault();
        event.stopPropagation();
        copySelectedObjects();
        return;
    }

    if(key==="v"){
        event.preventDefault();
        event.stopPropagation();
        pasteClipboardObjects();
    }
}

document.addEventListener("keydown",handleCopyPasteKeyDown,false);

window.copySelectedObjects=copySelectedObjects;

window.pasteClipboardObjects=pasteClipboardObjects;

window.encodeSelectedObjectsBinary=function(){
    if(typeof selectedObjects==="undefined"||!selectedObjects.length){
        return new Uint8Array(0);
    }

    return encodeObjects(selectedObjects);
};

window.decodeSelectedObjectsBinary=function(binary){
    return decodeObjects(binary);
};

})();
