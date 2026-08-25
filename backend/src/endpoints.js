// Curated financial infrastructure endpoints (PDF "Target Endpoints" table).
// Coordinates are approximate landmark locations for the destination pin on
// the globe, not the literal server rack location (which isn't public).
export const ENDPOINTS = [
  {
    id: "nse",
    label: "NSE India",
    type: "Stock exchange",
    host: "www.nseindia.com",
    lat: 19.0662,
    lon: 72.8697,
  },
  {
    id: "bse",
    label: "BSE India",
    type: "Stock exchange",
    host: "www.bseindia.com",
    lat: 18.9281,
    lon: 72.8319,
  },
  {
    id: "nyse",
    label: "NYSE",
    type: "Stock exchange",
    host: "www.nyse.com",
    lat: 40.7069,
    lon: -74.0113,
  },
  {
    id: "nasdaq",
    label: "Nasdaq",
    type: "Stock exchange",
    host: "www.nasdaq.com",
    lat: 40.7561,
    lon: -73.9863,
  },
  {
    id: "binance",
    label: "Binance API",
    type: "Crypto exchange",
    host: "api.binance.com",
    lat: 35.6762,
    lon: 139.6503,
  },
  {
    id: "aws-ap-south-1",
    label: "AWS ap-south-1",
    type: "Cloud region (HFT infra)",
    host: "ec2.ap-south-1.amazonaws.com",
    lat: 19.076,
    lon: 72.8777,
  },
  {
    id: "aws-us-east-1",
    label: "AWS us-east-1",
    type: "Cloud region (HFT infra)",
    host: "ec2.us-east-1.amazonaws.com",
    lat: 38.994,
    lon: -77.4524,
  },
  {
    id: "bloomberg",
    label: "Bloomberg",
    type: "Market data provider",
    host: "www.bloomberg.com",
    lat: 40.7639,
    lon: -73.97,
  },
  {
    id: "reuters",
    label: "Reuters",
    type: "Market data provider",
    host: "www.reuters.com",
    lat: 51.5054,
    lon: -0.0235,
  },
];

export function findEndpoint(id) {
  return ENDPOINTS.find((e) => e.id === id);
}
