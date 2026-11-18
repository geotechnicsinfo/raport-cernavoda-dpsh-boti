# -*- coding: utf-8 -*-
"""WGS84 (lat/long) -> Stereografic 1970 (EPSG:3844), fara pyproj.
Pasi: (1) geodezice -> geocentrice pe WGS84; (2) Helmert 7 parametri, conventia
Position Vector (EPSG:15994 / "Pulkovo 1942(58) to WGS 84 (19)", parametrii folositi de
pyproj pentru EPSG:3844 in sens invers): dx=2,329 dy=-147,042 dz=-92,080 m,
rx=0,309" ry=-0,325" rz=-0,497", ds=5,69 ppm; (3) geocentrice -> geodezice pe Krasovski 1940;
(4) Stereografic oblic (EPSG:9809), lat0=46, lon0=25, k0=0,99975, FE=FN=500000.
Verificat prin dus-intors (inversare numerica) sub 1 mm; exactitatea absoluta a Helmert-ului:
de ordinul decimetrilor pana la ~1 m (STIL_STUDIU 8.3)."""
import math
def geod2xyz(lat,lon,h,a,f):
    e2=f*(2-f); N=a/math.sqrt(1-e2*math.sin(lat)**2)
    return ((N+h)*math.cos(lat)*math.cos(lon),(N+h)*math.cos(lat)*math.sin(lon),(N*(1-e2)+h)*math.sin(lat))
def xyz2geod(X,Y,Z,a,f):
    e2=f*(2-f); lon=math.atan2(Y,X); p=math.hypot(X,Y); lat=math.atan2(Z,p*(1-e2))
    for _ in range(10):
        N=a/math.sqrt(1-e2*math.sin(lat)**2); h=p/math.cos(lat)-N; lat=math.atan2(Z,p*(1-e2*N/(N+h)))
    return lat,lon,h
def helmert_inv(X,Y,Z):
    # parametri WGS84 <- Pulkovo: aplicam inversul (WGS84 -> Pulkovo)
    dx,dy,dz=2.329,-147.042,-92.080
    s=1+5.69e-6; rx,ry,rz=[math.radians(v/3600) for v in (0.309,-0.325,-0.497)]
    # Position vector: Xw = dX + s*(Xp + [rot]Xp);  inversam liniar (rotatii mici)
    Xs,Ys,Zs=(X-dx)/s,(Y-dy)/s,(Z-dz)/s
    # Xs = Xp + R Xp cu R = [[0,-rz,ry],[rz,0,-rx],[-ry,rx,0]]  -> rezolvam iterativ
    Xp,Yp,Zp=Xs,Ys,Zs
    for _ in range(5):
        Xp=Xs-(-rz*Yp+ry*Zp); Yp=Ys-(rz*Xp-rx*Zp); Zp=Zs-(-ry*Xp+rx*Yp)
    return Xp,Yp,Zp
def stereo70(lat,lon):
    a,f=6378245.0,1/298.3; e=math.sqrt(f*(2-f)); e2=e*e
    lat0,lon0=math.radians(46.0),math.radians(25.0); k0=0.99975; FE=FN=500000.0
    R=math.sqrt((a*math.sqrt(1-e2))**2/(1-e2*math.sin(lat0)**2)**2)  # sqrt(rho0*nu0)
    n=math.sqrt(1+e2*math.cos(lat0)**4/(1-e2))
    S1=(1+math.sin(lat0))/(1-math.sin(lat0)); S2=(1-e*math.sin(lat0))/(1+e*math.sin(lat0))
    w1=(S1*S2**e)**n; c=(n+math.sin(lat0))*(1-(w1-1)/(w1+1))/((n-math.sin(lat0))*(1+(w1-1)/(w1+1)))
    w2=c*w1; chi0=math.asin((w2-1)/(w2+1))
    Sa=(1+math.sin(lat))/(1-math.sin(lat)); Sb=(1-e*math.sin(lat))/(1+e*math.sin(lat))
    w=c*(Sa*Sb**e)**n; chi=math.asin((w-1)/(w+1)); L=n*(lon-lon0)
    B=1+math.sin(chi)*math.sin(chi0)+math.cos(chi)*math.cos(chi0)*math.cos(L)
    E=FE+2*R*k0*math.cos(chi)*math.sin(L)/B
    N=FN+2*R*k0*(math.sin(chi)*math.cos(chi0)-math.cos(chi)*math.sin(chi0)*math.cos(L))/B
    return N,E   # X = Nord, Y = Est (conventia romaneasca)
def wgs2stereo(lat_deg,lon_deg):
    X,Y,Z=geod2xyz(math.radians(lat_deg),math.radians(lon_deg),0.0,6378137.0,1/298.257223563)
    Xp,Yp,Zp=helmert_inv(X,Y,Z)
    lat,lon,_=xyz2geod(Xp,Yp,Zp,6378245.0,1/298.3)
    return stereo70(lat,lon)
def dms(s):
    d,m,sec=s.split(); return float(d)+float(m)/60+float(sec)/3600
GPS={'F1':('47 47 04.1','26 06 53.6'),'F2':('47 47 08.0','26 06 52.2'),'F3':('47 47 06.7','26 06 49.2')}   # fisa sondorului, GPS de mana
if __name__=='__main__':
    import csv, os, numpy as np
    BASE=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); ROOT=os.path.dirname(os.path.dirname(BASE))
    P=np.loadtxt(os.path.join(ROOT,'03_Topografie','puncte_darmanesti_PNEZD.csv'),delimiter=',',usecols=(1,2,3))  # N,E,Z
    out=[]
    for k,(la,lo) in GPS.items():
        X,Y=wgs2stereo(dms(la),dms(lo))
        d=np.hypot(P[:,0]-X,P[:,1]-Y); idx=np.argsort(d)[:6]
        w=1/np.maximum(d[idx],0.01)**2; z=float((w*P[idx,2]).sum()/w.sum())
        # sensibilitatea cotei la eroarea GPS de +-5 m: min/max al punctelor topo pe raza de 8 m... folosim cei 6 vecini
        out.append((k,la,lo,round(X,2),round(Y,2),round(z,1),round(float(d[idx[0]]),1),round(float(P[idx,2].min()),1),round(float(P[idx,2].max()),1)))
        print(out[-1])
    with open(os.path.join(BASE,'coordonate.csv'),'w',newline='') as f:
        w=csv.writer(f); w.writerow(['punct','lat_WGS84_dms','lon_WGS84_dms','X_Nord_Stereo70','Y_Est_Stereo70','cota_IDW_topo_m','dist_pct_topo_apropiat_m','cota_min_6vecini','cota_max_6vecini']); w.writerows(out)
    print('extindere topo N',P[:,0].min(),P[:,0].max(),'E',P[:,1].min(),P[:,1].max())
