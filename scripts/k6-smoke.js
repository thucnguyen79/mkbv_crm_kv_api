// k6 smoke test — baseline 100 concurrent users hit các endpoint read-heavy.
// Chạy: k6 run -e BASE_URL=https://api.your-domain.com -e TOKEN="<jwt>" scripts/k6-smoke.js
//
// Target: p95 < 500ms cho các GET, error rate < 1%.
// Note: khởi tạo TOKEN bằng cách login trước, script này không login.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

const BASE_URL = __ENV.BASE_URL ?? 'http://localhost:3000/api/v1';
const TOKEN = __ENV.TOKEN ?? '';

const latency = new Trend('api_latency');
const errors = new Rate('api_errors');

const HEADERS = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

function hit(path, name) {
  const res = http.get(`${BASE_URL}${path}`, { headers: HEADERS, tags: { name } });
  latency.add(res.timings.duration, { name });
  const ok = check(res, {
    [`${name} 200`]: (r) => r.status === 200,
  });
  errors.add(!ok);
}

export default function () {
  hit('/health', 'health');
  hit('/customers?pageSize=20', 'customers_list');
  hit('/orders?pageSize=20', 'orders_list');
  hit('/products?pageSize=20', 'products_list');
  hit('/stock/summary', 'stock_summary');
  hit('/sync/status', 'sync_status');
  sleep(1);
}
