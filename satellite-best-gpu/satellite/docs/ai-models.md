# AI models

## GPU recommendation

The GPU Compose profile defaults to **Qwen/Qwen3-VL-4B-Instruct** with 4-bit loading. It is a practical laptop compromise between visual accuracy, grounding quality and latency. Qwen publishes the 4B model as an Apache-2.0 model and documents improved spatial perception/grounding.

For a laptop with more VRAM, set `VLM_MODEL_NAME=Qwen/Qwen3-VL-8B-Instruct` and consider `VLM_LOAD_IN_4BIT=true`. For lower-VRAM systems, keep the 4B 4-bit configuration.

## Runtime optimization

- GPU profile installs PyTorch 2.8.0 + torchvision 0.23.0 CUDA 12.8 wheels.
- `torch.inference_mode()` and deterministic generation are used for lower inference overhead.
- SDPA attention is enabled instead of a source build of FlashAttention.
- The model is loaded once at FastAPI startup and cached for all requests.
- Whole-image previews prevent the previous top-left-crop accuracy problem.
- Grounding uses at most four 768px tiles by default.
- Change detection is deterministic raster math; the VLM is used for semantic interpretation rather than pixel differencing.

## Hardware

For NVIDIA laptops, Docker must have GPU support/NVIDIA Container Toolkit configured. Verify on the host with `nvidia-smi`, then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```
