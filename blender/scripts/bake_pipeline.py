
import bpy, os, json, traceback, bmesh
D=bpy.path.abspath("//")  # carpeta del .blend (blender/ en el repo)
exec(open(os.path.join(D,"scripts","helpers.py"),encoding="utf-8").read())
ST=os.path.join(D,"bake_status.json")
def status(**k):
    json.dump(k, open(ST,"w"))
def run():
  try:
    sc=bpy.context.scene; sc.render.engine='CYCLES'; sc.cycles.samples=4
    os.makedirs(os.path.join(D,"texturas"),exist_ok=True)
    web=coll('Web'); web.hide_render=False
    for o in web.objects: o.hide_render=False
    jobs=[('bun_top',2048,0.6),('bun_bottom',2048,0.3),('patty_angus_250g',2048,0.25)]
    for name,res,coat in jobs:
        status(step="preparando "+name)
        remove_obj(name+'_web')
        src=bpy.data.objects[name]
        ob=src.copy(); ob.data=src.data.copy(); ob.name=name+'_web'; ob.parent=None
        for cc in list(ob.users_collection): cc.objects.unlink(ob)
        web.objects.link(ob); ob.location=(0,0,0); ob.rotation_euler=(0,0,0)
        for m in ob.modifiers:
            if m.type=='SUBSURF': m.levels=1
        bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active=ob; ob.select_set(True)
        for m in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.004)
        bpy.ops.object.mode_set(mode='OBJECT')
        imgs={}
        for kind,cs in (('color','sRGB'),('rough','Non-Color'),('normal','Non-Color')):
            nm=name+'_'+kind; im=bpy.data.images.get(nm)
            if im: bpy.data.images.remove(im)
            im=bpy.data.images.new(nm,res,res,alpha=False,float_buffer=(kind=='normal'))
            im.colorspace_settings.name=cs; imgs[kind]=im
        for kind,btype in (('color','DIFFUSE'),('rough','ROUGHNESS'),('normal','NORMAL')):
            status(step="horneando "+kind+" de "+name)
            for mat in ob.data.materials:
                nt=mat.node_tree
                for n in [n for n in nt.nodes if n.name.startswith('BAKE_')]: nt.nodes.remove(n)
                t=nt.nodes.new('ShaderNodeTexImage'); t.name='BAKE_'+kind; t.image=imgs[kind]
                for n in nt.nodes: n.select=False
                t.select=True; nt.nodes.active=t
            if btype=='DIFFUSE':
                bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, margin=8)
            else:
                bpy.ops.object.bake(type=btype, margin=8)
            p=os.path.join(D,"texturas",name+'_'+kind+('.png'))
            imgs[kind].filepath_raw=p; imgs[kind].file_format='PNG'; imgs[kind].save()
        for mat in ob.data.materials:
            for n in [n for n in mat.node_tree.nodes if n.name.startswith('BAKE_')]: mat.node_tree.nodes.remove(n)
        # material horneado
        m,nt,b=new_mat(name+'_baked'); L=nt.links
        tc=nt.nodes.new('ShaderNodeTexImage'); tc.image=imgs['color']; L.new(tc.outputs[0],b.inputs['Base Color'])
        tr=nt.nodes.new('ShaderNodeTexImage'); tr.image=imgs['rough']
        sp=nt.nodes.new('ShaderNodeSeparateColor'); L.new(tr.outputs[0],sp.inputs[0]); L.new(sp.outputs[0],b.inputs['Roughness'])
        tn=nt.nodes.new('ShaderNodeTexImage'); tn.image=imgs['normal']
        nm_=nt.nodes.new('ShaderNodeNormalMap'); L.new(tn.outputs[0],nm_.inputs['Color']); L.new(nm_.outputs[0],b.inputs['Normal'])
        b.inputs['Coat Weight'].default_value=coat; b.inputs['Coat Roughness'].default_value=0.28
        ob.data.materials.clear(); ob.data.materials.append(m)
        for pl in ob.data.polygons: pl.material_index=0
        ob['stack_height']=src.get('stack_height',0)
    # semillas
    remove_obj('bun_top_sesame_web')
    s=bpy.data.objects['bun_top_sesame']; sw=s.copy(); sw.data=s.data.copy(); sw.name='bun_top_sesame_web'
    for cc in list(sw.users_collection): cc.objects.unlink(sw)
    web.objects.link(sw); sw.parent=bpy.data.objects['bun_top_web']; sw.matrix_parent_inverse.identity(); sw.location=(0,0,0); sw.rotation_euler=(0,0,0)
    bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active=sw; sw.select_set(True)
    for m in list(sw.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
    # export
    status(step="exportando GLB")
    out={}
    for fn,objs in {'bun_top':['bun_top_web','bun_top_sesame_web'],'bun_bottom':['bun_bottom_web'],'patty_angus_250g':['patty_angus_250g_web']}.items():
        bpy.ops.object.select_all(action='DESELECT')
        for n in objs: bpy.data.objects[n].select_set(True)
        bpy.context.view_layer.objects.active=bpy.data.objects[objs[0]]
        p=os.path.join(D,"glb",fn+".glb")
        bpy.ops.export_scene.gltf(filepath=p, use_selection=True, export_apply=True, export_yup=True, export_extras=True,
            export_image_format='JPEG', export_jpeg_quality=88, export_draco_mesh_compression_enable=True)
        out[fn]=round(os.path.getsize(p)/1e6,2)
        for n in objs:
            o=bpy.data.objects[n]; out[fn+'_tris']=out.get(fn+'_tris',0)+sum(len(pl.vertices)-2 for pl in o.data.polygons)
    web.hide_render=True
    bpy.ops.wm.save_mainfile()
    status(step="listo", glb=out)
  except Exception:
    status(step="error", err=traceback.format_exc())
  return None
