"""Reproducible Android wrapper build; supply a private keystore outside Git."""
from pathlib import Path
import argparse,subprocess,zipfile
p=argparse.ArgumentParser();p.add_argument('--tools',required=True);p.add_argument('--android-jar',required=True);p.add_argument('--ecj',required=True);p.add_argument('--keystore',required=True);p.add_argument('--alias',default='threecard');p.add_argument('--output',required=True);a=p.parse_args()
root=Path(__file__).resolve().parent;build=root/'build';(build/'classes').mkdir(parents=True,exist_ok=True);(build/'dex').mkdir(exist_ok=True);tools=Path(a.tools).resolve();jar=Path(a.android_jar).resolve();output=Path(a.output).resolve()
def run(args):subprocess.run([str(x) for x in args],cwd=root,check=True)
run(['java','-jar',Path(a.ecj).resolve(),'-source','1.8','-target','1.8','-encoding','UTF-8','-classpath',jar,'-d',build/'classes',*sorted((root/'src').rglob('*.java'))])
resources=build/'resources.zip'
if resources.exists():resources.unlink()
run([tools/'aapt2','compile','--dir','res','-o',resources]);run([tools/'aapt2','link','-o',build/'unsigned.apk','--manifest','AndroidManifest.xml','-I',jar,resources]);run([tools/'d8','--lib',jar,'--min-api','26','--output',build/'dex',*sorted((build/'classes').rglob('*.class'))])
with zipfile.ZipFile(build/'unsigned.apk','a',zipfile.ZIP_DEFLATED) as z:z.write(build/'dex/classes.dex','classes.dex')
run([tools/'zipalign','-f','-p','4',build/'unsigned.apk',build/'aligned.apk']);run([tools/'apksigner','sign','--ks',Path(a.keystore).resolve(),'--ks-key-alias',a.alias,'--ks-pass','pass:android','--key-pass','pass:android','--out',output,build/'aligned.apk']);run([tools/'apksigner','verify','--verbose',output]);print(output)
