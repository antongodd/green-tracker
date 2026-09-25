"""Builds the background-removal model in client/public/ai/ (D26).

Not run by the build: the output is committed. Run it only to rebuild the model.

    pip install onnx onnxruntime numpy
    python3 scripts/make-cutout-model.py

Steps (each found necessary on a real iPhone, see SPEC §4 "Remove background"):
1. Start from ISNet "general use" (IS-Net, Qin et al., Apache-2.0), as exported to
   ONNX by the rembg project (MIT): 179 MB, fixed 1024×1024 input.
2. Shrink it to ~47 MB by storing weights as 8-bit numbers. The first 3 and last 12
   convolutions stay full precision: quantising them too left speckles and kept
   pieces of the background.
3. Let it run at 768×768 (the app's size): its upsampling steps had the 1024 sizes
   baked in, so each becomes a scale factor (×2 … ×64). At 1024 one cut-out needed
   about 1 GB of memory and iOS closed the page; at 768 it's about 40% of that, with
   the same accuracy on the test scenes (smaller sizes started making mistakes).
4. Keep only the main output (the side outputs cost memory and aren't used).
5. Split into 12 MB parts, named by the file's hash so a new model is a new URL.
"""
import hashlib, os, urllib.request
import numpy as np
import onnx
import onnxruntime as ort
from onnx import helper, numpy_helper
from onnxruntime.quantization import QuantType, quantize_dynamic

SRC_URL = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx'
WORK = '/tmp/gt-cutout-model'
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'client', 'public', 'ai')
PART = 12_000_000

os.makedirs(WORK, exist_ok=True)
src = os.path.join(WORK, 'isnet-general-use.onnx')
if not os.path.exists(src):
    urllib.request.urlretrieve(SRC_URL, src)

# 2. Quantise, keeping the first and last convolutions in full precision.
q8 = os.path.join(WORK, 'isnet-q8.onnx')
convs = [n.name for n in onnx.load(src).graph.node if n.op_type == 'Conv']
quantize_dynamic(src, q8, weight_type=QuantType.QUInt8, per_channel=True, nodes_to_exclude=convs[:3] + convs[-12:])

# 3. Resize nodes: replace the baked-in target sizes with the scale they applied at 1024.
probe = onnx.load(q8)
resizes = [n for n in probe.graph.node if n.op_type == 'Resize']
for n in resizes:
    probe.graph.output.append(helper.make_tensor_value_info(n.input[0], onnx.TensorProto.FLOAT, None))
    probe.graph.output.append(helper.make_tensor_value_info(n.output[0], onnx.TensorProto.FLOAT, None))
sess = ort.InferenceSession(probe.SerializeToString())
outs = sess.run(None, {sess.get_inputs()[0].name: np.zeros((1, 3, 1024, 1024), np.float32)})
shape = {o.name: v.shape for o, v in zip(sess.get_outputs(), outs)}

m = onnx.load(q8)
scales = []
for n in m.graph.node:
    if n.op_type != 'Resize':
        continue
    a, b = shape[n.input[0]], shape[n.output[0]]
    name = n.name + '_scales'
    scales.append(numpy_helper.from_array(np.array([1, 1, b[2] / a[2], b[3] / a[3]], np.float32), name))
    ins = list(n.input) + [''] * (4 - len(n.input))
    del n.input[:]
    n.input.extend([ins[0], ins[1], name])
m.graph.initializer.extend(scales)
dims = m.graph.input[0].type.tensor_type.shape.dim
dims[2].dim_param, dims[3].dim_param = 'h', 'w'
del m.graph.value_info[:]

# 4. Only the main output, with a free shape.
main = onnx.ValueInfoProto()
main.CopyFrom(m.graph.output[0])
del m.graph.output[:]
m.graph.output.append(main)
for j, d in enumerate(m.graph.output[0].type.tensor_type.shape.dim):
    d.dim_param = f'o{j}'
data = m.SerializeToString()

# Check it runs at 768.
check = ort.InferenceSession(data)
res = check.run(None, {check.get_inputs()[0].name: np.zeros((1, 3, 768, 768), np.float32)})[0]
assert res.shape == (1, 1, 768, 768), res.shape

# 5. Parts named by hash.
h = hashlib.sha256(data).hexdigest()[:8]
for i in range(0, len(data), PART):
    with open(os.path.join(OUT_DIR, f'isnet-bud-{h}.part{i // PART}.bin'), 'wb') as f:
        f.write(data[i:i + PART])
print(f'isnet-bud-{h}: {len(data)} bytes in {(len(data) + PART - 1) // PART} parts; update CUTOUT_MODEL in shared/domain/cutout.ts')
