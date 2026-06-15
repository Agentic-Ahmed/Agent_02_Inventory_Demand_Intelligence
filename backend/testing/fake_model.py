"""Deterministic fake model for the mock test mode.

Subclasses the SDK Model interface (same pattern as the SDK's own test suite) so
agent runs need NO API key. It emits a single assistant message whose text is the
JSON of a Forecast; the SDK parses that against the agent's output_type, then runs
the output guardrails on it — exercising the full pipeline deterministically.
"""
from agents.models.interface import Model
from agents.items import ModelResponse
from agents.usage import Usage
from openai.types.responses import ResponseOutputMessage, ResponseOutputText


class FakeModel(Model):
    def __init__(self, output_json: str):
        self._json = output_json

    async def get_response(self, *args, **kwargs) -> ModelResponse:
        message = ResponseOutputMessage(
            id="fake-msg-1",
            type="message",
            role="assistant",
            status="completed",
            content=[
                ResponseOutputText(text=self._json, type="output_text", annotations=[])
            ],
        )
        return ModelResponse(output=[message], usage=Usage(), response_id=None)

    async def stream_response(self, *args, **kwargs):  # pragma: no cover
        raise NotImplementedError("FakeModel does not support streaming")
        yield  # makes this an async generator
