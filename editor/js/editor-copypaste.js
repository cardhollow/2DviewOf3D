(function(){
"use strict";

var MAGIC_0=0x50;
var MAGIC_1=0x4F;
var MAGIC_2=0x42;
var MAGIC_3=0x43;
var VERSION=4;
var CLIPBOARD_TYPE="web application/x-platformer-editor-objects";

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
    var bytes=new TextEncoder().encode(String(value==null?"":value));
    this.writeUint32(bytes.length);
    for(var i=0;i<bytes.length;i++)this.data.push(bytes[i]);
};

BinaryWriter.prototype.writeJSON=function(value){
    var text=JSON.stringify(value);
    this.writeString(text);
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

BinaryReader.prototype.readJSON=function(){
    var text=this.readString();
    if(!text)return {};
    return JSON.parse(text);
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

function getSerializableUserData(object){
    var source=object.userData||{};
    var result={};

    for(var key in source){
        if(!source.hasOwnProperty(key))continue;

        var value=source[key];

        try{
            JSON.stringify(value);
            result[key]=value;
        }catch(error){}
    }

    result.editorObject=true;

    if(!result.type){
        result.type="object";
    }

    return result;
}

function getMaterialData(object){
    var material=object.material;

    if(Array.isArray(material)){
        material=material[0];
    }

    if(!material){
        return {
            type:"",
            color:0xFFFFFF,
            opacity:1,
            transparent:false,
            wireframe:false,
            visible:true,
            side:0,
            roughness:1,
            metalness:0,
            shininess:30,
            flatShading:false,
            depthWrite:true,
            depthTest:true,
            alphaTest:0
        };
    }

    return {
        type:material.type||"",
        color:material.color?material.color.getHex():0xFFFFFF,
        opacity:typeof material.opacity==="number"?material.opacity:1,
        transparent:!!material.transparent,
        wireframe:!!material.wireframe,
        visible:material.visible!==false,
        side:typeof material.side==="number"?material.side:0,
        roughness:typeof material.roughness==="number"?material.roughness:1,
        metalness:typeof material.metalness==="number"?material.metalness:0,
        shininess:typeof material.shininess==="number"?material.shininess:30,
        flatShading:!!material.flatShading,
        depthWrite:material.depthWrite!==false,
        depthTest:material.depthTest!==false,
        alphaTest:typeof material.alphaTest==="number"?material.alphaTest:0
    };
}

function writeGeometry(writer,geometry){
    if(!geometry){
        writer.writeUint32(0);
        writer.writeUint32(0);
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

        writeVector3(writer,face.normal||new THREE.Vector3());

        writer.writeUint8(
            typeof face.materialIndex==="number"
                ?face.materialIndex
                :0
        );

        if(face.color){
            writer.writeUint8(1);
            writer.writeUint32(face.color.getHex());
        }else{
            writer.writeUint8(0);
            writer.writeUint32(0xFFFFFF);
        }
    }

    var uvs=geometry.faceVertexUvs&&geometry.faceVertexUvs[0]?geometry.faceVertexUvs[0]:[];

    writer.writeUint32(uvs.length);

    for(var u=0;u<uvs.length;u++){
        var uvFace=uvs[u]||[];

        for(var p=0;p<3;p++){
            var uv=uvFace[p]||new THREE.Vector2();

            writer.writeFloat32(uv.x);
            writer.writeFloat32(uv.y);
        }
    }

    var colors=geometry.colors||[];

    writer.writeUint32(colors.length);

    for(var c=0;c<colors.length;c++){
        writer.writeUint32(
            colors[c]&&colors[c].getHex
                ?colors[c].getHex()
                :0xFFFFFF
        );
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
        var face=new THREE.Face3(
            reader.readUint32(),
            reader.readUint32(),
            reader.readUint32()
        );

        face.normal=readVector3(reader);
        face.materialIndex=reader.readUint8();

        var hasColor=reader.readUint8();
        var color=reader.readUint32();

        if(hasColor){
            face.color=new THREE.Color(color);
        }

        geometry.faces.push(face);
    }

    var uvCount=reader.readUint32();

    geometry.faceVertexUvs[0]=[];

    for(var u=0;u<uvCount;u++){
        geometry.faceVertexUvs[0].push([
            new THREE.Vector2(
                reader.readFloat32(),
                reader.readFloat32()
            ),
            new THREE.Vector2(
                reader.readFloat32(),
                reader.readFloat32()
            ),
            new THREE.Vector2(
                reader.readFloat32(),
                reader.readFloat32()
            )
        ]);
    }

    var colorCount=reader.readUint32();

    if(colorCount){
        geometry.colors=[];

        for(var c=0;c<colorCount;c++){
            geometry.colors.push(
                new THREE.Color(
                    reader.readUint32()
                )
            );
        }
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
        writer.writeString(object.type||object.userData&&object.userData.type||"object");
        writer.writeJSON(getSerializableUserData(object));

        writeVector3(writer,object.position);

        writer.writeFloat32(object.rotation.x);
        writer.writeFloat32(object.rotation.y);
        writer.writeFloat32(object.rotation.z);
        writer.writeString(object.rotation.order||"XYZ");

        writeVector3(writer,object.scale);

        writer.writeJSON(getMaterialData(object));

        writeGeometry(writer,object.geometry);
    }

    return writer.toUint8Array();
}

function decodeObjects(binary){
    var reader=new BinaryReader(binary);

    if(
        reader.readUint8()!==MAGIC_0||
        reader.readUint8()!==MAGIC_1||
        reader.readUint8()!==MAGIC_2||
        reader.readUint8()!==MAGIC_3
    ){
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
        var userData=reader.readJSON();

        var position=readVector3(reader);

        var rotation=new THREE.Euler(
            reader.readFloat32(),
            reader.readFloat32(),
            reader.readFloat32(),
            reader.readString()
        );

        var scale=readVector3(reader);
        var material=reader.readJSON();
        var geometry=readGeometry(reader);

        userData=userData||{};
        userData.editorObject=true;

        if(!userData.type){
            userData.type=type||"object";
        }

        objects.push({
            name:name,
            type:type,
            userData:userData,
            position:position,
            rotation:rotation,
            scale:scale,
            material:material,
            geometry:geometry
        });
    }

    return objects;
}

function createClipboardObject(data){
    var material=null;

    if(typeof createMaterial==="function"){
        material=createMaterial(
            "#"+
            data.material.color.toString(16).padStart(6,"0")
        );
    }

    if(!material){
        var MaterialClass=THREE.MeshStandardMaterial;

        if(
            data.material.type==="MeshPhongMaterial"&&
            typeof THREE.MeshPhongMaterial==="function"
        ){
            MaterialClass=THREE.MeshPhongMaterial;
        }else if(
            data.material.type==="MeshLambertMaterial"&&
            typeof THREE.MeshLambertMaterial==="function"
        ){
            MaterialClass=THREE.MeshLambertMaterial;
        }else if(
            data.material.type==="MeshBasicMaterial"&&
            typeof THREE.MeshBasicMaterial==="function"
        ){
            MaterialClass=THREE.MeshBasicMaterial;
        }

        material=new MaterialClass({
            color:data.material.color,
            opacity:data.material.opacity,
            transparent:data.material.transparent,
            wireframe:data.material.wireframe,
            visible:data.material.visible,
            side:data.material.side
        });
    }

    if(material.color){
        material.color.setHex(data.material.color);
    }

    material.opacity=data.material.opacity;
    material.transparent=data.material.transparent;
    material.wireframe=data.material.wireframe;
    material.visible=data.material.visible;

    if(typeof material.side==="number"){
        material.side=data.material.side;
    }

    if("roughness" in material){
        material.roughness=data.material.roughness;
    }

    if("metalness" in material){
        material.metalness=data.material.metalness;
    }

    if("shininess" in material){
        material.shininess=data.material.shininess;
    }

    if("flatShading" in material){
        material.flatShading=data.material.flatShading;
    }

    material.depthWrite=data.material.depthWrite;
    material.depthTest=data.material.depthTest;
    material.alphaTest=data.material.alphaTest;

    var object=new THREE.Mesh(
        data.geometry,
        material
    );

    object.name=data.name+"_Copy";

    object.position.copy(data.position);
    object.rotation.copy(data.rotation);
    object.scale.copy(data.scale);

    object.userData=data.userData||{};
    object.userData.editorObject=true;

    if(!object.userData.type){
        object.userData.type=data.type||"object";
    }

    return object;
}

async function copySelectedObjects(){
    if(typeof selectedObjects==="undefined"||!selectedObjects.length){
        return;
    }

    if(!navigator.clipboard||!window.ClipboardItem){
        if(typeof statusElement!=="undefined"){
            statusElement.textContent="External clipboard is not supported";
        }
        return;
    }

    try{
        var binary=encodeObjects(selectedObjects);
        var blob=new Blob([binary],{type:CLIPBOARD_TYPE});

        await navigator.clipboard.write([
            new ClipboardItem({
                [CLIPBOARD_TYPE]:blob
            })
        ]);

        if(typeof statusElement!=="undefined"){
            statusElement.textContent=
                selectedObjects.length+
                " object"+
                (selectedObjects.length===1?"":"s")+
                " copied";
        }
    }catch(error){
        console.error("Copy objects error:",error);

        if(typeof statusElement!=="undefined"){
            statusElement.textContent="External copy failed";
        }

        alert(
            "Could not copy objects:\n"+
            error.message
        );
    }
}

async function pasteClipboardObjects(){
    if(!navigator.clipboard||!navigator.clipboard.read){
        if(typeof statusElement!=="undefined"){
            statusElement.textContent="External clipboard is not supported";
        }
        return;
    }

    try{
        var items=await navigator.clipboard.read();
        var binary=null;

        for(var i=0;i<items.length;i++){
            var item=items[i];

            if(item.types.indexOf(CLIPBOARD_TYPE)!==-1){
                var blob=await item.getType(CLIPBOARD_TYPE);
                binary=new Uint8Array(
                    await blob.arrayBuffer()
                );
                break;
            }
        }

        if(!binary){
            if(typeof statusElement!=="undefined"){
                statusElement.textContent="No editor objects in clipboard";
            }
            return;
        }

        var data=decodeObjects(binary);

        if(!data.length){
            return;
        }

        var before=serializeScene();
        var pasted=[];

        for(var j=0;j<data.length;j++){
            var object=createClipboardObject(data[j]);

            object.position.x+=1;
            object.userData=object.userData||{};
            object.userData.editorObject=true;

            scene.add(object);
            objectCounter++;
            pasted.push(object);
        }

        setSelectedObjects(
            pasted,
            pasted[pasted.length-1]
        );

        selectionAnchor=pasted[pasted.length-1];

        recordModification(before);
        saveLocal();

        statusElement.textContent=
            data.length+
            " object"+
            (data.length===1?"":"s")+
            " pasted";
    }catch(error){
        console.error("Paste objects error:",error);

        if(typeof statusElement!=="undefined"){
            statusElement.textContent="External paste failed";
        }

        alert(
            "Could not paste objects:\n"+
            error.message
        );
    }
}

function isTypingTarget(target){
    if(!target){
        return false;
    }

    var tag=String(target.tagName||"").toLowerCase();

    if(
        tag==="input"||
        tag==="textarea"||
        tag==="select"||
        tag==="option"||
        target.isContentEditable
    ){
        return true;
    }

    if(
        typeof target.closest==="function"&&
        target.closest(
            "input,textarea,select,[contenteditable='true']"
        )
    ){
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

    var hasSelection=
        typeof selectedObjects!=="undefined"&&
        selectedObjects.length>0;

    var key=String(
        event.key||""
    ).toLowerCase();

    if(key==="c"&&hasSelection){
        event.preventDefault();
        event.stopPropagation();
        copySelectedObjects();
        return;
    }

    if(key==="v"&&hasSelection){
        event.preventDefault();
        event.stopPropagation();
        pasteClipboardObjects();
    }
}

document.addEventListener(
    "keydown",
    handleCopyPasteKeyDown,
    false
);

window.copySelectedObjects=
    copySelectedObjects;

window.pasteClipboardObjects=
    pasteClipboardObjects;

window.encodeSelectedObjectsBinary=
    function(){
        if(typeof selectedObjects==="undefined"||!selectedObjects.length){
            return new Uint8Array(0);
        }

        return encodeObjects(
            selectedObjects
        );
    };

window.decodeSelectedObjectsBinary=
    function(binary){
        return decodeObjects(binary);
    };

})();
