import * as DTOs from '@voiceflow/dtos';
import {
  CardV2TraceComponent,
  ChoiceTraceComponent,
  RuntimeAction,
  TextTraceComponent,
  Trace,
  TraceDeclaration,
  VisualTraceComponent,
} from '@voiceflow/sdk-runtime';

import { CardProps, isValidCard } from './components/Card';
import type { SystemResponseProps } from './components/SystemResponse';
import { MessageType } from './components/SystemResponse/constants';

export interface RuntimeContext extends Pick<SystemResponseProps, 'messages' | 'actions'> {}

export const MESSAGE_TRACES: TraceDeclaration<RuntimeContext, any>[] = [
  TextTraceComponent(({ context }, trace) => {
    if (!DTOs.TextTraceDTO.safeParse(trace).success) return context;

    const { slate, message, ai, delay } = trace.payload;

    context.messages.push({
      type: MessageType.TEXT,
      text: slate?.content || message,
      delay,
      ...(ai ? { ai } : {}),
    });

    return context;
  }),
  VisualTraceComponent(({ context }, trace) => {
    if (!DTOs.VisualTraceDTO.safeParse(trace).success) return context;

    context.messages.push({ type: MessageType.IMAGE, url: trace.payload.image });
    return context;
  }),
  ChoiceTraceComponent(({ context }, trace) => {
    if (!DTOs.ChoiceTraceDTO.safeParse(trace).success) return context;

    const {
      payload: { buttons },
    } = trace;
    context.actions = (buttons as { name: string; request: RuntimeAction }[]).map(({ name, request }) => ({
      name,
      request,
    }));
    return context;
  }),
  CardV2TraceComponent(({ context }, trace) => {
    if (!DTOs.CardDTO.safeParse(trace).success) return context;

    const {
      payload: { title, imageUrl, description, buttons },
    } = trace;
    const card: CardProps = {
      title,
      description: description.text,
      image: imageUrl,
      actions: buttons.map(({ name, request }) => ({ name, request })),
    };

    if (isValidCard(card)) {
      context.messages.push({
        type: 'card',
        ...card,
      });
    }
    return context;
  }),
  {
    canHandle: ({ type }) => type === Trace.TraceType.CAROUSEL,
    handle: ({ context }, trace: Trace.Carousel) => {
      if (!DTOs.CarouselTraceDTO.safeParse(trace).success) return context;

      const cards: CardProps[] = trace.payload.cards
        .map(({ title, description, imageUrl, buttons }) => ({
          title,
          description: description.text,
          image: imageUrl,
          actions: buttons.map(({ name, request }) => ({ name, request })),
        }))
        .filter(isValidCard);

      if (cards.length) {
        context.messages.push({
          type: MessageType.CAROUSEL,
          cards,
        });
      }

      return context;
    },
  },
  {
    canHandle: ({ type }) => type === Trace.TraceType.END,
    handle: ({ context }) => {
      context.messages.push({ type: MessageType.END });
      return context;
    },
  },
];
