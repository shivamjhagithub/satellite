from __future__ import annotations

import io
import logging
import os
import threading

from PIL import Image

from app.config import settings
from app.utils.errors import AppError
from app.vlm.base import VisionLanguageModel

log = logging.getLogger(__name__)


class QwenVisionLanguageModel(VisionLanguageModel):
    def __init__(self) -> None:
        self._model = None
        self._processor = None
        self._loaded = False
        self._inference_lock = threading.Lock()

    def is_loaded(self) -> bool:
        return self._loaded

    def load(self) -> None:
        if self._loaded:
            return
        try:
            import torch
            from transformers import AutoProcessor, Qwen3VLForConditionalGeneration
        except Exception as ex:
            log.exception("Failed to import torch/transformers for VLM load")
            raise AppError(
                503,
                "VLM_NOT_AVAILABLE",
                f"transformers/torch import failed: {ex}",
            ) from ex
        device = settings.vlm_device
        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "cpu"
        if device == "cpu":
            cpu_count = os.cpu_count() or 1
            torch.set_num_threads(cpu_count)
            log.info("VLM running on CPU with %d threads", cpu_count)
        try:
            quantization_config = None
            if device == "cuda" and settings.vlm_load_in_4bit:
                from transformers import BitsAndBytesConfig

                quantization_config = BitsAndBytesConfig(
                    load_in_4bit=True,
                    bnb_4bit_compute_dtype=torch.bfloat16,
                    bnb_4bit_quant_type="nf4",
                    bnb_4bit_use_double_quant=True,
                )
            self._processor = AutoProcessor.from_pretrained(settings.vlm_model_name)
            self._model = Qwen3VLForConditionalGeneration.from_pretrained(
                settings.vlm_model_name,
                dtype=torch.bfloat16 if device == "cuda" else torch.float32,
                device_map="auto" if device == "cuda" else None,
                quantization_config=quantization_config,
                low_cpu_mem_usage=True,
                attn_implementation="sdpa",
            )
            if device == "cpu":
                self._model = self._model.to("cpu")
            self._model.eval()
            self._loaded = True
            log.info("Loaded VLM %s on %s", settings.vlm_model_name, device)
        except Exception as ex:
            self._loaded = False
            raise AppError(503, "VLM_LOAD_FAILED", f"Could not load {settings.vlm_model_name}: {ex}") from ex

    def caption(self, image_bytes: bytes, prompt: str) -> str:
        return self.answer([image_bytes], prompt)

    def answer(self, image_bytes: list[bytes], question: str) -> str:
        if not self._loaded:
            self.load()
        try:
            import torch
            images = [Image.open(io.BytesIO(b)).convert("RGB") for b in image_bytes]
            messages = [
                {
                    "role": "user",
                    "content": [{"type": "image", "image": image} for image in images]
                               + [{"type": "text", "text": question}],
                }
            ]
            inputs = self._processor.apply_chat_template(
                messages,
                tokenize=True,
                add_generation_prompt=True,
                return_dict=True,
                return_tensors="pt",
            )
            # A single GPU generation at a time keeps VRAM predictable on laptop GPUs
            # and avoids two concurrent requests causing an OOM.
            with self._inference_lock:
                inputs = inputs.to(self._model.device)
                with torch.inference_mode():
                    if self._model.device.type == "cuda":
                        with torch.autocast(device_type="cuda", dtype=torch.bfloat16):
                            generated_ids = self._model.generate(
                                **inputs,
                                max_new_tokens=settings.vlm_max_new_tokens,
                                do_sample=False,
                                num_beams=1,
                                use_cache=True,
                                pad_token_id=self._processor.tokenizer.eos_token_id,
                            )
                    else:
                        generated_ids = self._model.generate(
                            **inputs,
                            max_new_tokens=settings.vlm_max_new_tokens,
                            do_sample=False,
                            num_beams=1,
                            use_cache=True,
                            pad_token_id=self._processor.tokenizer.eos_token_id,
                        )
            trimmed = [
                output_ids[len(input_ids):]
                for input_ids, output_ids in zip(inputs.input_ids, generated_ids)
            ]
            return self._processor.batch_decode(
                trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
            )[0].strip()
        except AppError:
            raise
        except Exception as ex:
            raise AppError(500, "VLM_INFERENCE_FAILED", f"VLM inference failed: {ex}") from ex

