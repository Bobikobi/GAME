"""Compose 128 px figure frames onto a painted place at zoom 3 (1920 x 1080) and cut the 844 x 390 phone window (from the
clothing-look trial). One pipeline for every still: box reduction of the frame by SCALE (51/96), hard alpha, ink edge,
nearest x3. The figure is pasted on the painted plate; the engine does not draw it, and a card says so."""
import numpy as np, sys, os
from PIL import Image
HOME=os.path.expanduser('~')
PLATES={'13:00':f'{HOME}/Projects/GAME/.scratch/run-land/lands/place-village-edge/composed-light-1300.png','dusk':f'{HOME}/Projects/GAME/.scratch/run-land/lands/place-village-edge/composed-light-1730.png'}
PLATE=PLATES['13:00']
BODY_H=96            # kept bare figure: opaque rows 22..118 of the 128 frame
TARGET_H=51          # the painted scene's figure, art px (DECISIONS 2026-11-11)
SCALE=TARGET_H/BODY_H
INK=(0x1b,0x1a,0x2e)
Z=3

def reduce_frame(im):
    """128px RGBA frame -> reduced RGBA (box filter on premultiplied alpha, hard alpha > 127), ink edge on the outer rim."""
    a=np.asarray(im.convert('RGBA'),dtype=np.float64)
    h,w=a.shape[:2]
    nh,nw=round(h*SCALE),round(w*SCALE)
    pre=a.copy(); pre[...,:3]*=a[...,3:4]/255.0
    p=Image.fromarray(pre.round().astype(np.uint8),'RGBA').resize((nw,nh),Image.BOX) if False else None
    # manual box resample (fractional) via PIL BOX on float channels
    chans=[Image.fromarray(pre[...,c].astype(np.float32),'F').resize((nw,nh),Image.BOX) for c in range(4)]
    out=np.stack([np.asarray(c) for c in chans],-1)
    al=out[...,3]
    rgb=np.where(al[...,None]>0, out[...,:3]/np.maximum(al[...,None],1e-6)*255.0, 0)
    rgb=np.clip(rgb,0,255)
    mask=al>127
    res=np.zeros((nh,nw,4),np.uint8); res[...,:3]=rgb.round().astype(np.uint8); res[...,3]=np.where(mask,255,0)
    return Image.fromarray(res,'RGBA')

def ink_edge(im):
    """one px ink line #1b1a2e on opaque pixels that touch transparency (4-neighbour)."""
    a=np.array(im); m=a[...,3]>0
    pad=np.pad(m,1); nb=pad[:-2,1:-1]&pad[2:,1:-1]&pad[1:-1,:-2]&pad[1:-1,2:]
    edge=m&~nb
    a[edge,:3]=INK
    return Image.fromarray(a,'RGBA')

def up(arr,z=Z): return np.repeat(np.repeat(arr,z,0),z,1)

def compose(fig128, out_full, out_phone, cx=410, cy=440, with_patch=True, plate_path=None):
    plate=np.asarray(Image.open(plate_path or PLATE).convert('RGB'))
    fr=ink_edge(reduce_frame(fig128))
    a=np.asarray(fr); ys,xs=np.where(a[...,3]>0)
    top,bot,left,right=ys.min(),ys.max(),xs.min(),xs.max()
    # window 640x360 art px, figure feet at (cx,cy) in plate coordinates
    W,H=1920//Z,1080//Z
    x0=cx-W//2; y0=cy-int(H*0.62)   # feet at ~62% down the frame
    x0=max(0,min(plate.shape[1]-W,x0)); y0=max(0,min(plate.shape[0]-H,y0))
    win=plate[y0:y0+H,x0:x0+W].astype(np.float64)
    fx=cx-x0; fy=cy-y0   # feet position in window (art px)
    # contact patch 13x3 art px, eased, under the feet
    if with_patch:
        yy,xx=np.mgrid[0:H,0:W]
        d=((xx-fx)/6.5)**2+((yy-(fy-1))/1.6)**2
        k=np.clip(1-d,0,1)*0.45
        win*= (1-k[...,None])
        win+= k[...,None]*np.array([20,20,30])*0  # darken only
    big=up(win.round().astype(np.uint8))
    # figure: pasted at art-px resolution then enlarged x3 (one art pixel = 3 device pixels)
    layer=np.zeros((H,W,4),np.uint8)
    px=int(fx-(left+right)//2); py=int(fy-bot)
    sub=a
    H2,W2=sub.shape[:2]
    for yy in range(H2):
        for xx in range(W2):
            if sub[yy,xx,3]>0:
                Y,X=py+yy,px+xx
                if 0<=Y<H and 0<=X<W: layer[Y,X]=sub[yy,xx]
    L=up(layer)
    al=(L[...,3:4]>0)
    big=np.where(al,L[...,:3],big).astype(np.uint8)
    full=Image.fromarray(big,'RGB'); full.save(out_full)
    # phone window 844x390 screen px around the figure (zoom 3, same pixel scale as the full frame)
    fxs,fys=int(fx*Z),int((fy-(bot-top)/2)*Z)
    px0=max(0,min(1920-844,fxs-422)); py0=max(0,min(1080-390,fys-195))
    full.crop((px0,py0,px0+844,py0+390)).save(out_phone)
    bbox=[int((px+left)*Z),int((py+top)*Z),int((px+right+1)*Z),int((py+bot+1)*Z)]
    return dict(bbox_full=bbox,figure_h_art=int(bot-top+1),figure_w_art=int(right-left+1),figure_h_screen=int(bot-top+1)*Z)

if __name__=='__main__':
    fig=Image.open(sys.argv[1]).convert('RGBA')
    print(compose(fig,sys.argv[2],sys.argv[3]))
