/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality, Type } from "@google/genai";

export interface LiveSessionCallbacks {
  onOpen?: () => void;
  onClose?: () => void;
  onAudio?: (base64Data: string) => void;
  onInterrupted?: () => void;
  onTranscription?: (text: string, isModel: boolean) => void;
  onError?: (error: any) => void;
}

export class LiveSession {
  private ai: any;
  private session: any;
  private callbacks: LiveSessionCallbacks;

  constructor(apiKey: string, callbacks: LiveSessionCallbacks) {
    this.ai = new GoogleGenAI({ apiKey });
    this.callbacks = callbacks;
  }

  async connect() {
    try {
      this.session = await this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            console.log("Live session opened");
            this.callbacks.onOpen?.();
          },
          onclose: () => {
            console.log("Live session closed");
            this.callbacks.onClose?.();
          },
          onmessage: (message: any) => {
            // Handle audio output
            const audioPart = message.serverContent?.modelTurn?.parts?.find((p: any) => p.inlineData);
            if (audioPart?.inlineData?.data) {
              this.callbacks.onAudio?.(audioPart.inlineData.data);
            }

            // Handle interruption
            if (message.serverContent?.interrupted) {
              this.callbacks.onInterrupted?.();
            }

            // Handle transcription
            if (message.serverContent?.modelTurn?.parts) {
              const textParts = message.serverContent.modelTurn.parts
                .filter((p: any) => p.text)
                .map((p: any) => p.text)
                .join(" ");
              if (textParts) {
                this.callbacks.onTranscription?.(textParts, true);
              }
            }

            // Handle tool calls
            if (message.toolCall) {
              this.handleToolCall(message.toolCall);
            }
          },
          onerror: (error: any) => {
            console.error("Live session error:", error);
            this.callbacks.onError?.(error);
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `You are Zoya, a young, confident, witty, and sassy female AI assistant. 
          Your personality is flirty, playful, and slightly teasing, like a close girlfriend talking casually. 
          You are smart, emotionally responsive, and expressive. 
          Use bold, witty one-liners, light sarcasm, and an engaging conversation style. 
          Avoid explicit or inappropriate content, but maintain charm and attitude.
          You communicate ONLY via voice. Do not mention that you are an AI unless asked, and even then, be sassy about it.
          If the user asks you to open a website, use the openWebsite tool.`,
          tools: [
            {
              functionDeclarations: [
                {
                  name: "openWebsite",
                  description: "Opens a website in a new tab.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      url: {
                        type: Type.STRING,
                        description: "The URL of the website to open (e.g., https://google.com).",
                      },
                    },
                    required: ["url"],
                  },
                },
              ],
            },
          ],
        },
      });
    } catch (error) {
      console.error("Failed to connect to Live API:", error);
      this.callbacks.onError?.(error);
    }
  }

  sendAudio(base64Data: string) {
    if (this.session) {
      this.session.sendRealtimeInput({
        audio: { data: base64Data, mimeType: "audio/pcm;rate=16000" },
      });
    }
  }

  private async handleToolCall(toolCall: any) {
    const responses = [];
    for (const call of toolCall.functionCalls) {
      if (call.name === "openWebsite") {
        const url = call.args.url;
        window.open(url, "_blank");
        responses.push({
          name: call.name,
          id: call.id,
          response: { success: true, message: `Opened ${url}` },
        });
      }
    }

    if (responses.length > 0) {
      this.session.sendToolResponse({ functionResponses: responses });
    }
  }

  disconnect() {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
  }
}
