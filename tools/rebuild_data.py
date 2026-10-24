#!/usr/bin/env python3
"""
Tạo lại dữ liệu web (data/game.json + img/) từ source gốc KPAH.
Chỉ cần chạy khi bạn sửa SQL / ảnh gốc. Yêu cầu: Python 3 + Pillow (pip install pillow).

Cách dùng:
  python3 tools/rebuild_data.py --server <thư mục KPAH (có data/, src/)> --client <thư mục KPAH_225> --sql <kpah.sql> --out <thư mục kpah-web>
"""
import argparse, json, os, re, shutil, glob, struct, sys, collections
from PIL import Image
ap=argparse.ArgumentParser()
ap.add_argument('--server',required=True); ap.add_argument('--client',required=True)
ap.add_argument('--sql',required=True); ap.add_argument('--out',default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ap.add_argument('--work',default='_work')
A=ap.parse_args()
WORK=os.path.abspath(A.work); os.makedirs(WORK,exist_ok=True)

# ---------- 1. SQL -> JSON
def sql2json(path):
    src=open(path,encoding='utf-8').read(); tables={}
    def parse_values(s,i):
        rows=[]
        while True:
            while s[i] in ' \n\r\t,': i+=1
            if s[i]==';': return rows,i+1
            i+=1; row=[]
            while True:
                while s[i] in ' \n\r\t': i+=1
                if s[i]=="'":
                    i+=1; buf=[]
                    while True:
                        c=s[i]
                        if c=='\\': buf.append({'n':'\n','r':'\r','t':'\t','0':'\0'}.get(s[i+1],s[i+1])); i+=2
                        elif c=="'":
                            if s[i+1]=="'": buf.append("'"); i+=2
                            else: i+=1; break
                        else: buf.append(c); i+=1
                    row.append(''.join(buf))
                else:
                    j=i
                    while s[j] not in ',)': j+=1
                    tok=s[i:j].strip(); i=j
                    row.append(None if tok=='NULL' else (int(tok) if re.fullmatch(r'-?\d+',tok) else float(tok)))
                while s[i] in ' \n\r\t': i+=1
                if s[i]==',': i+=1; continue
                if s[i]==')': i+=1; break
            rows.append(row)
    for m in re.finditer(r"INSERT INTO `(\w+)` \(([^)]*)\) VALUES",src):
        cn=[c.strip(' `') for c in m.group(2).split(',')]
        rows,_=parse_values(src,m.end())
        tables.setdefault(m.group(1),[]).extend(dict(zip(cn,r)) for r in rows)
    return tables
db=sql2json(A.sql); print('SQL tables:',len(db))

# ---------- 2. Ảnh trong client Unity (resources.assets: TextAsset chứa PNG)
CB=os.path.join(WORK,'client_bin'); CP=os.path.join(WORK,'client_png'); os.makedirs(CB,exist_ok=True); os.makedirs(CP,exist_ok=True)
d=open(os.path.join(A.client,'KPAH_225_Data','resources.assets'),'rb').read(); i=0; res=[]
while True:
    i=d.find(b'\x89PNG\r\n\x1a\n',i)
    if i<0: break
    found=False
    for off in range(4,64):
        p=i-off
        if p<8: break
        L=struct.unpack('<I',d[p:p+4])[0]
        if L<off-4 or L>5_000_000: continue
        for nl in range(1,40):
            q=p-((nl+3)//4*4)-4
            if q<0: break
            if struct.unpack('<I',d[q:q+4])[0]==nl:
                s=d[q+4:q+4+nl]
                if all(32<=c<127 for c in s): res.append((s.decode(),p+4,L)); found=True; break
        if found: break
    if found: i=res[-1][1]+res[-1][2]
    else: i+=8
cnt=collections.Counter(n for n,_,_ in res)
for name,st,L in res:
    fn=name if cnt[name]==1 else f"{name}__{st}"
    blob=d[st:st+L]; open(os.path.join(CB,fn+'.bin'),'wb').write(blob)
    a=blob.find(b'\x89PNG'); b=blob.find(b'IEND')+8
    open(os.path.join(CP,fn+'.png'),'wb').write(blob[a:b])
print('client assets:',len(res))

# ---------- 3. Ảnh quái (mã hoá XOR "NguyenVanMinh")
K=b"NguyenVanMinh"; SIG=b'\x89PNG\r\n\x1a\n'
MP=os.path.join(WORK,'mob_png'); os.makedirs(MP,exist_ok=True)
def dec(d,start): return bytes(d[start+i]^K[i%13] for i in range(len(d)-start))
for f in glob.glob(os.path.join(A.server,'data','map','mobImage','*')):
    d=open(f,'rb').read(); mid=os.path.basename(f); x=None
    for s in range(0,80):
        t=dec(d,s)
        if t[:8]==SIG: x=t; mode='enc'; break
    if x is None: s=d.find(SIG); x=d[s:]; mode='raw'
    starts=[]; p=0
    while True:
        p=x.find(SIG,p)
        if p<0: break
        starts.append(p); p+=8
    last=x[starts[-1]:x.find(b'IEND',starts[-1])+8]
    if mode=='raw': png=x[:x.find(b'IEND')+8]
    elif len(starts)>1: first=x[:starts[1]]; png=first[:-5]+last[len(first)-5:]
    else: png=last
    open(os.path.join(MP,mid+'.png'),'wb').write(png)
    try: Image.open(os.path.join(MP,mid+'.png')).load()
    except Exception: open(os.path.join(MP,mid+'.png'),'wb').write(last)
print('mobs decoded')

# ---------- 4. Xuất dữ liệu web
SP=WORK; SRC=os.path.join(A.server,'data'); OUT=os.path.abspath(A.out)
def J(s,default=None):
    if s is None: return default
    s=s.strip()
    if s.startswith("'") and s.endswith("'"): s=s[1:-1]
    try: return json.loads(s)
    except Exception: return default
def mk(p): os.makedirs(p,exist_ok=True)
for d in ['img/tiles','img/mob','img/cloth/0','img/cloth/1','img/cloth/2','img/cloth/3','img/cloth/4','img/weapon','img/tree','img/icon','img/fx','img/ui','img/skill','data']:
    mk(f'{OUT}/{d}')

# ---- tiles
for t in ['t','t_hang','t_thanh']:
    shutil.copy(f'{SP}/client_png/{t}.png',f'{OUT}/img/tiles/{t}.png')
tileTypes={}
for t in ['t','t_hang','t_thanh']:
    tileTypes[t]=[b if b<128 else b-256 for b in open(f'{SRC}/map/typeOfTile/{t}','rb').read()]

# ---- maps
mobTpl={m['id']:m for m in db['monsters']}
maps={}
mapsById={m['id']:m for m in db['maps']}
def mapWH(mid):
    d=J(mapsById[mid]['data']); return d[0]
for m in db['maps']:
    mid=m['id']; d=J(m['data']); w,h=d[0]; tiles=d[1]
    tiles=[255 if v==254 else v for v in tiles]
    ts='t_thanh' if mid>200 else ('t' if mid<110 else 't_hang')
    tops=[]
    for grp in J(m['tileTop'],[]) or []:
        for e in grp:
            if len(e)==3: tops.append(e)
    wps=[]
    for e in J(m['locationWayPoints'],[]) or []:
        a,b,c,x,y=e
        # normalise: [toMap,toX,toY,x,y]; fix swapped entries
        cand=[(a,b,c),(b,a,c)]
        ok=None
        for tm,tx,ty in cand:
            if tm in mapsById:
                W,H=mapWH(tm)
                if 0<=tx<W and 0<=ty<H: ok=(tm,tx,ty); break
        if ok: wps.append([ok[0],ok[1],ok[2],x,y])
    named=J(m['wayPoints'],[]) or []
    mobs=[e for e in (J(m['mobs'],[]) or []) if e[0] in mobTpl]
    maps[mid]=dict(id=mid,name=m['name'].strip(),w=w,h=h,ts=ts,tiles=tiles,tops=tops,
        trees=J(m['tree'],[]) or [],mobs=mobs,npcs=J(m['npcs'],[]) or [],actors=J(m['npcsActor'],[]) or [],
        wps=wps,named=named,offline=m['isOfflineMap'],xaPhu=m['idXaPhu'],childs=J(m['childMap'],[]) or [])

# ---- mobs images
mobs={}
for m in db['monsters']:
    k=str(m['id'])
    if not os.path.exists(f'{SP}/mob_png/{k}.png'): continue
    src=f'{SP}/mob_png/{k}.png'
    im=Image.open(src).convert('RGBA')
    W,H=im.size; w,h=m['w'],m['h']
    if W==w and H%h==0: kind='strip'; fw,fh,n=w,h,H//h
    elif W==w and H==h: kind='strip'; fw,fh,n=w,h,1
    else:
        kind='static'
        # crop bounding box of the largest region in the first quarter, fallback whole
        bb=im.getbbox() or (0,0,W,H)
        fw,fh,n=W,H,1
    im.save(f'{OUT}/img/mob/{k}.png')
    mobs[m['id']]=dict(id=m['id'],name=m['name'].strip(),lv=m['level'],hp=m['maxHp'],type=m['type'],mv=m['moveType'],spd=m['speed'],
        w=fw,h=fh,n=n,kind=kind)

# ---- char parts
parts={}
for r in db['char_part']:
    t,i=r['type'],r['idPart']
    p=f'{SRC}/image/cloth/{t}/{i}.png'
    if not os.path.exists(p): continue
    shutil.copy(p,f'{OUT}/img/cloth/{t}/{i}.png')
    parts.setdefault(t,{})[i]=dict(x=J(r['x']),y=J(r['y']),w=J(r['w']),h=J(r['h']),dx=J(r['dx']),dy=J(r['dy']),
        av=[r['avx0'],r['avy0'],r['avw0'],r['avh0'],r['avxf'],r['avyf']])

# ---- weapons, trees
for p in glob.glob(f'{SRC}/image/weapon/*.png'): shutil.copy(p,f'{OUT}/img/weapon/'+os.path.basename(p))
trees={}
for r in db['tree_info']:
    p=f'{SRC}/image/tree/{r["id"]}.png'
    if os.path.exists(p):
        shutil.copy(p,f'{OUT}/img/tree/{r["id"]}.png'); trees[r['id']]=[r['dx'],r['dy']]

# ---- items
items={}
icons=set()
for r in db['item_equipment']:
    items[r['id']]=dict(id=r['id'],name=r['name'].replace('\r','').strip(),cls=r['classChar'],icon=r['idIcon'],type=r['type'],st=r['stype'],
        gender=r['gender'],lv=r['level'],dur=r['durable'],price=r['price'],color=r['colorItem'],att=J(r['attribute'],[]),wp=J(r['dataWeapon'],[]))
    icons.add(r['idIcon'])
# icon atlas: 16x16 cells
icons=sorted(i for i in icons if os.path.exists(f'{SRC}/image/icon/{i}.png'))
cols=32; rows=(len(icons)+cols-1)//cols
atlas=Image.new('RGBA',(cols*16,rows*16),(0,0,0,0)); iconIdx={}
for k,i in enumerate(icons):
    im=Image.open(f'{SRC}/image/icon/{i}.png').convert('RGBA')
    x=(k%cols)*16+(16-im.width)//2; y=(k//cols)*16+(16-im.height)//2
    atlas.paste(im,(x,y),im); iconIdx[i]=k
atlas.save(f'{OUT}/img/icon/items.png')
shutil.copy(f'{SRC}/image/potion/potion.png',f'{OUT}/img/icon/potion.png')
for c in range(5): shutil.copy(f'{SRC}/image/skill/{c}.png',f'{OUT}/img/skill/{c}.png')
potions={r['id']:dict(id=r['id'],name=r['name'].replace('\r','').split('\n')[0].strip(),desc=r['name'].replace('\r',''),img=r['idImage'],delay=r['delay'],price=r['price'],rec=r['recovered']) for r in db['potion_template']}
attrs={r['id']:dict(name=r['name'].replace('\r','').strip(),pct=r['isPercent']) for r in db['item_attribute']}

# ---- fx from client
fx={}
for n in range(42,73):
    cands=[p for p in glob.glob(f'{SP}/client_png/{n}.png')+glob.glob(f'{SP}/client_png/{n}__*.png')]
    for p in cands:
        im=Image.open(p)
        # numbered client strips with no frame data
        b=p.replace('client_png','client_bin').replace('.png','.bin')
        d=open(b,'rb').read()
        if len(d)-(d.find(b'IEND')+8)!=0: continue
        W,H=im.size; nf=max(1,round(H/W)); 
        while H%nf and nf>1: nf-=1
        im.convert('RGBA').save(f'{OUT}/img/fx/{n}.png'); fx[n]=[W,H//nf,nf]; break
for nm in ['shadow__828656','b3','t0','t1','tg','Big0','skill_da','skill_ice','skillboss','kiem01','h0','logo','waiting','imgshadow']:
    p=f'{SP}/client_png/{nm}.png'
    if os.path.exists(p): Image.open(p).convert('RGBA').save(f'{OUT}/img/ui/{nm.split("__")[0]}.png')

others={r['type']:J(r['data']) for r in db['others']}
xaphu={r['id']:dict(maps=J(r['mapId']),x=J(r['x']),y=J(r['y']),price=J(r['price'])) for r in db['xa_phu_template']}
shops={r['nameShop']:dict(type=r['typeShop'],items=J(r['items'],[])) for r in db['npc_shop']}
npcActor={r['id']:dict(name=r['name'],head=r['head'],body=J(r['itemBody'],[])) for r in db['npc_actor']}
skillNew=[dict(name=r['name'],desc=r['decript'].strip(),skill=r['idSkill'],cls=r['charClass'],price=r['price']) for r in db['skill_news']]

game=dict(maps=maps,tileTypes=tileTypes,mobs=mobs,parts=parts,trees=trees,items=items,iconIdx=iconIdx,potions=potions,attrs=attrs,
    fx=fx,others=others,xaphu=xaphu,shops=shops,npcActor=npcActor,skillNew=skillNew)
json.dump(game,open(f'{OUT}/data/game.json','w'),ensure_ascii=False,separators=(',',':'))
print('maps',len(maps),'mobs',len(mobs),'items',len(items),'icons',len(icons),'fx',sorted(fx))
print(os.path.getsize(f'{OUT}/data/game.json')//1024,'KB')

# ---- sửa ảnh boss dạng ghép (113, 129, 130)
def frames_from(i, boxes):
    im=Image.open(f'{SP}/mob_png/{i}.png').convert('RGBA')
    crops=[im.crop(b) for b in boxes]
    w=max(c.width for c in crops); h=max(c.height for c in crops)
    out=Image.new('RGBA',(w,h*len(crops)))
    for k,c in enumerate(crops): out.paste(c,((w-c.width)//2,k*h+(h-c.height)),c)
    out.save(f'{OUT}/img/mob/{i}.png')
    game['mobs'][i].update(w=w,h=h,n=len(crops),kind='strip',loop=1)
frames_from(129,[(183,2,218,46),(0,116,35,161),(215,113,252,157)])
frames_from(130,[(4,114,50,159),(67,111,119,151)])
src=Image.open(f'{SP}/mob_png/59.png').convert('RGBA')
src.resize((src.width*2,src.height*2),Image.NEAREST).save(f'{OUT}/img/mob/113.png')
m59=game['mobs'][59]; game['mobs'][113].update(w=m59['w']*2,h=m59['h']*2,n=m59['n'],kind='strip')
for k,m in maps.items():
    if not m['name']: m['name']='Nhà ông nội' if k==105 else ('Trong nhà' if m['offline'] or k in (102,103,104,108,109) else '')
json.dump(game,open(f'{OUT}/data/game.json','w'),ensure_ascii=False,separators=(',',':'))
print('bosses fixed')
