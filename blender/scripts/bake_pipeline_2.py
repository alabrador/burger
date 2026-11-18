
import bpy, os, json, traceback, bmesh
D=bpy.path.abspath("//")  # carpeta del .blend (blender/ en el repo)
exec(open(os.path.join(D,"scripts","helpers.py"),encoding="utf-8").read())
ST=os.path.join(D,"bake_status.json")
def status(**k): json.dump(k, open(ST,"w"))
PIECES=[('cheese_cheddar',['cheese_cheddar'],0.0518,1024,0.35),
        ('lettuce_leaf',['lettuce_leaf','lettuce_leaf_2'],0.0206,2048,0.15),
        ('tomato_slices',['tomato_slices','tomato_slice_2','tomato_slice_3'],0.0232,1024,0.7)]
def make_web(name, members, zbase):
    remove_obj(name+'_web')
    web=coll('Web'); web.hide_render=False
    dg=bpy.context.evaluated_depsgraph_get()
    bm=bmesh.new(); mats=[]
    for mn in members:
        o=bpy.data.objects[mn]; ev=o.evaluated_get(dg); me=ev.to_mesh()
        me.transform(o.matrix_world)
        for ms in me.materials:
            if ms and ms not in mats: mats.append(ms)
        bm.from_mesh(me); ev.to_mesh_clear()
    bmesh.ops.translate(bm, vec=(0,0,-zbase), verts=bm.verts)
    nm=bpy.data.meshes.new(name+'_web'); bm.to_mesh(nm); bm.free()
    for m in mats: nm.materials.append(m)
    ob=bpy.data.objects.new(name+'_web',nm); web.objects.link(ob)
    return ob
def run():
  try:
    sc=bpy.context.scene; sc.render.engine='CYCLES'; sc.cycles.samples=4
    out={}
    for name,members,zb,res,coat in PIECES:
        status(step="preparando "+name)
        ob=make_web(name,members,zb)
        bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active=ob; ob.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.004)
        bpy.ops.object.mode_set(mode='OBJECT')
        imgs={}
        for kind,cs in (('color','sRGB'),('rough','Non-Color'),('normal','Non-Color')):
            n=name+'_'+kind; im=bpy.data.images.get(n)
            if im: bpy.data.images.remove(im)
            im=bpy.data.images.new(n,res,res,alpha=False,float_buffer=(kind=='normal')); im.colorspace_settings.name=cs; imgs[kind]=im
        for kind,bt in (('color','DIFFUSE'),('rough','ROUGHNESS'),('normal','NORMAL')):
            status(step="horneando "+kind+" de "+name)
            for mat in ob.data.materials:
                t=mat.node_tree
                for x in [x for x in t.nodes if x.name.startswith('BAKE_')]: t.nodes.remove(x)
                tn=t.nodes.new('ShaderNodeTexImage'); tn.name='BAKE_'+kind; tn.image=imgs[kind]
                for x in t.nodes: x.select=False
                tn.select=True; t.nodes.active=tn
            if bt=='DIFFUSE': bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, margin=8)
            else: bpy.ops.object.bake(type=bt, margin=8)
            imgs[kind].filepath_raw=os.path.join(D,"texturas",name+'_'+kind+'.png'); imgs[kind].file_format='PNG'; imgs[kind].save()
        for mat in ob.data.materials:
            for x in [x for x in mat.node_tree.nodes if x.name.startswith('BAKE_')]: mat.node_tree.nodes.remove(x)
        m,nt,b=new_mat(name+'_baked'); L=nt.links
        a=nt.nodes.new('ShaderNodeTexImage'); a.image=imgs['color']; L.new(a.outputs[0],b.inputs['Base Color'])
        r=nt.nodes.new('ShaderNodeTexImage'); r.image=imgs['rough']; sp=nt.nodes.new('ShaderNodeSeparateColor'); L.new(r.outputs[0],sp.inputs[0]); L.new(sp.outputs[0],b.inputs['Roughness'])
        nn=nt.nodes.new('ShaderNodeTexImage'); nn.image=imgs['normal']; nm_=nt.nodes.new('ShaderNodeNormalMap'); L.new(nn.outputs[0],nm_.inputs['Color']); L.new(nm_.outputs[0],b.inputs['Normal'])
        b.inputs['Coat Weight'].default_value=coat; b.inputs['Coat Roughness'].default_value=0.15
        ob.data.materials.clear(); ob.data.materials.append(m)
        for pl in ob.data.polygons: pl.material_index=0
        for pl in ob.data.polygons: pl.use_smooth=True
        ob['stack_height']=bpy.data.objects[members[0]].get('stack_height',0)
        status(step="exportando "+name)
        bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active=ob
        bpy.ops.export_scene.gltf(filepath=os.path.join(D,"glb",name+".glb"), use_selection=True, export_apply=True, export_yup=True, export_extras=True,
            export_image_format='JPEG', export_jpeg_quality=88, export_draco_mesh_compression_enable=True)
        dm=ob.modifiers.new('Dec','DECIMATE'); dm.ratio=0.5
        bpy.ops.export_scene.gltf(filepath=os.path.join(D,"glb","web_preview",name+".glb"), use_selection=True, export_apply=True, export_yup=True, export_extras=True,
            export_image_format='JPEG', export_jpeg_quality=85, export_draco_mesh_compression_enable=False)
        ob.modifiers.remove(dm)
        out[name]=sum(len(p.vertices)-2 for p in ob.data.polygons)
    coll('Web').hide_render=True
    bpy.ops.wm.save_mainfile()
    status(step="listo", tris=out)
  except Exception:
    status(step="error", err=traceback.format_exc())
  return None
