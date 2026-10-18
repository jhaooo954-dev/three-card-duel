from pathlib import Path
import argparse,subprocess,zipfile
p=argparse.ArgumentParser();p.add_argument('--tools',required=True);p.add_argument('--android-jar',required=True);p.add_argument('--ecj',required=True);p.add_argument('--output',default='ThreeCard-Android-v1.0.apk');a=p.parse_args()
root=Path(__file__).resolve().parent;tools=Path(a.tools).resolve();android=str(Path(a.android_jar).resolve());ecj=str(Path(a.ecj).resolve());output=Path(a.output).resolve()
build=root/'build';(build/'classes').mkdir(parents=True,exist_ok=True);(build/'dex').mkdir(exist_ok=True)
def run(cmd):subprocess.run([str(x) for x in cmd],cwd=root,check=True)
run(['java','-jar',ecj,'-source','1.8','-target','1.8','-encoding','UTF-8','-classpath',android,'-d',build/'classes',root/'src/com/threecard/duel/MainActivity.java'])
resources=build/'resources.zip'
if resources.exists():resources.unlink()
run([tools/'aapt2','compile','--dir','res','-o',resources])
run([tools/'aapt2','link','-o',build/'unsigned.apk','--manifest','AndroidManifest.xml','-I',android,'-A','assets',resources])
run([tools/'d8','--lib',android,'--min-api','26','--output',build/'dex',*sorted((build/'classes').rglob('*.class'))])
with zipfile.ZipFile(build/'unsigned.apk','a',zipfile.ZIP_DEFLATED) as z:z.write(build/'dex/classes.dex','classes.dex')
run([tools/'zipalign','-f','-p','4',build/'unsigned.apk',build/'aligned.apk'])
run([tools/'apksigner','sign','--ks','private/threecard-dev.p12','--ks-key-alias','threecard','--ks-pass','pass:android','--key-pass','pass:android','--out',output,build/'aligned.apk'])
run([tools/'apksigner','verify','--verbose',output]);print(output)
