"""Deterministic fake models for the mock test mode.

Subclass the SDK Model interface (same pattern as the SDK's own test suite) so
agent runs need NO API key:
  - FakeModel:          non-streaming; emits one assistant message (used by the evals).
  - StreamingFakeModel: streams the text as output_text deltas then completes; lets us
                        exercise Runner.run_streamed and the SSE chat endpoint offline.
"""
from agents.models.interface import Model
from agents.items import ModelResponse
from agents.usage import Usage
from openai.types.responses import (
    Response,
    ResponseCompletedEvent,
    ResponseOutputMessage,
    ResponseOutputText,
    ResponseTextDeltaEvent,
)


def _assistant_message(text: str) -> ResponseOutputMessage:
    """A single completed assistant message carrying `text`."""
    return ResponseOutputMessage(
        id="fake-msg-1",
        type="message",
        role="assistant",
        status="completed",
        content=[ResponseOutputText(text=text, type="output_text", annotations=[])],
    )


class FakeModel(Model):
    def __init__(self, output_json: str):
        self._json = output_json

    async def get_response(self, *args, **kwargs) -> ModelResponse:
        return ModelResponse(output=[_assistant_message(self._json)], usage=Usage(), response_id=None)

    async def stream_response(self, *args, **kwargs):  # pragma: no cover
        raise NotImplementedError("FakeModel does not support streaming; use StreamingFakeModel")
        yield  # makes this an async generator


class StreamingFakeModel(Model):
    """Streams `text` as output_text deltas, then a 'response.completed' event.

    Faithful enough to drive Runner.run_streamed: the run loop forwards the deltas
    as raw_response_events and builds the final output from the completed Response.
    """

    def __init__(self, text: str, chunk: int = 12):
        self._text = text
        self._chunk = max(1, chunk)

    async def get_response(self, *args, **kwargs) -> ModelResponse:
        return ModelResponse(output=[_assistant_message(self._text)], usage=Usage(), response_id=None)

    async def stream_response(self, *args, **kwargs):
        seq = 0
        for i in range(0, len(self._text), self._chunk):
            yield ResponseTextDeltaEvent(
                type="response.output_text.delta",
                delta=self._text[i : i + self._chunk],
                content_index=0,
                item_id="fake-msg-1",
                output_index=0,
                logprobs=[],
                sequence_number=seq,
            )
            seq += 1
        response = Response(
            id="resp-fake-1",
            created_at=0.0,
            model="fake",
            object="response",
            output=[_assistant_message(self._text)],
            parallel_tool_calls=False,
            tool_choice="auto",
            tools=[],
        )
        yield ResponseCompletedEvent(
            type="response.completed", response=response, sequence_number=seq
        )
