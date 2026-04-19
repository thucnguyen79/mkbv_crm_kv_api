import { MessageChannel, MessageStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { MessagingProcessor } from './messaging.processor';
import { ProviderFactory } from './providers/provider.factory';
import { ProviderFallbackError } from './providers/message-provider.interface';
import { MessagingJobData, MessagingService } from './messaging.service';

interface FakeLog {
  id: bigint;
  customerId: number | null;
  phone: string;
  channel: MessageChannel;
  templateCode: string | null;
  payload: { body: string; variables?: Record<string, unknown> };
  status: MessageStatus;
  attempts: number;
  providerId: string | null;
  providerName: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  sentAt: Date | null;
}

function makeFakeLog(overrides: Partial<FakeLog> = {}): FakeLog {
  return {
    id: 1n,
    customerId: 42,
    phone: '0912345678',
    channel: MessageChannel.ZNS,
    templateCode: 'ZNS_REACTIVATE_30D',
    payload: { body: 'Chào An', variables: {} },
    status: MessageStatus.QUEUED,
    attempts: 0,
    providerId: null,
    providerName: null,
    errorCode: null,
    errorMessage: null,
    sentAt: null,
    ...overrides,
  };
}

function makePrismaMock(log: FakeLog) {
  return {
    messageLog: {
      update: jest.fn((args: { data: Record<string, unknown> }) => {
        const data = { ...args.data };
        const attempts = data.attempts as { increment?: number } | number | undefined;
        if (attempts && typeof attempts === 'object' && typeof attempts.increment === 'number') {
          log.attempts += attempts.increment;
          delete data.attempts;
        }
        Object.assign(log, data);
        return Promise.resolve({ ...log });
      }),
      findUnique: jest.fn(() => Promise.resolve({ ...log })),
    },
  };
}

function makeJob(data: Partial<MessagingJobData> = {}, attemptsMade = 0, attempts = 3): Job<MessagingJobData> {
  return {
    data: {
      logId: '1',
      allowFallback: false,
      campaignExecId: null,
      fallbackTemplateCode: null,
      ...data,
    },
    attemptsMade,
    opts: { attempts },
  } as unknown as Job<MessagingJobData>;
}

describe('MessagingProcessor', () => {
  it('marks log SENT on success', async () => {
    const log = makeFakeLog();
    const prisma = makePrismaMock(log);
    const sendSpy = jest.fn().mockResolvedValue({ providerId: 'pid-1', providerName: 'zns-stub' });
    const factory = { get: jest.fn().mockReturnValue({ send: sendSpy }) } as unknown as ProviderFactory;
    const templates = {} as never;
    const messaging = {} as unknown as MessagingService;

    const proc = new MessagingProcessor(prisma as never, factory, templates, messaging);
    await proc.process(makeJob());

    expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({ phone: '0912345678', body: 'Chào An' }));
    expect(log.status).toBe(MessageStatus.SENT);
    expect(log.providerId).toBe('pid-1');
    expect(log.providerName).toBe('zns-stub');
    expect(log.sentAt).toBeInstanceOf(Date);
  });

  it('throws and marks RETRYING when attempts remain', async () => {
    const log = makeFakeLog();
    const prisma = makePrismaMock(log);
    const factory = {
      get: jest.fn().mockReturnValue({ send: jest.fn().mockRejectedValue(new Error('boom')) }),
    } as unknown as ProviderFactory;
    const proc = new MessagingProcessor(prisma as never, factory, {} as never, {} as never);

    await expect(proc.process(makeJob({}, 0, 3))).rejects.toThrow('boom');
    expect(log.status).toBe(MessageStatus.RETRYING);
    expect(log.errorCode).toBe('PROVIDER_ERROR');
  });

  it('marks FAILED on last attempt', async () => {
    const log = makeFakeLog();
    const prisma = makePrismaMock(log);
    const factory = {
      get: jest.fn().mockReturnValue({ send: jest.fn().mockRejectedValue(new Error('dead')) }),
    } as unknown as ProviderFactory;
    const proc = new MessagingProcessor(prisma as never, factory, {} as never, {} as never);

    await expect(proc.process(makeJob({}, 2, 3))).rejects.toThrow('dead');
    expect(log.status).toBe(MessageStatus.FAILED);
  });

  it('falls back ZNS→SMS when allowed and does not rethrow', async () => {
    const log = makeFakeLog();
    const prisma = makePrismaMock(log);
    const factory = {
      get: jest
        .fn()
        .mockReturnValue({
          send: jest
            .fn()
            .mockRejectedValue(new ProviderFallbackError('TEMPLATE_REJECTED', 'rejected')),
        }),
    } as unknown as ProviderFactory;
    const templateLoad = jest.fn().mockResolvedValue({
      code: 'SMS_REACTIVATE_30D',
      channel: MessageChannel.SMS,
      body: 'Hi {{name}}',
      isActive: true,
    });
    const templates = { loadActiveByCode: templateLoad } as never;
    const enqueueSpy = jest.fn().mockResolvedValue(2n);
    const messaging = { enqueue: enqueueSpy } as unknown as MessagingService;
    const proc = new MessagingProcessor(prisma as never, factory, templates, messaging);

    log.payload = { body: 'Chào An', variables: { name: 'An' } };

    await expect(
      proc.process(
        makeJob({ allowFallback: true, fallbackTemplateCode: 'SMS_REACTIVATE_30D' }),
      ),
    ).resolves.toBeUndefined();

    expect(log.status).toBe(MessageStatus.FALLBACK);
    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: MessageChannel.SMS,
        phone: '0912345678',
        allowFallback: false,
      }),
    );
  });

  it('does NOT fallback when allowFallback=false even on ProviderFallbackError', async () => {
    const log = makeFakeLog();
    const prisma = makePrismaMock(log);
    const factory = {
      get: jest
        .fn()
        .mockReturnValue({
          send: jest.fn().mockRejectedValue(new ProviderFallbackError('X', 'x')),
        }),
    } as unknown as ProviderFactory;
    const proc = new MessagingProcessor(prisma as never, factory, {} as never, {} as never);

    await expect(proc.process(makeJob({}, 0, 3))).rejects.toThrow('x');
    expect(log.status).toBe(MessageStatus.RETRYING);
  });
});
