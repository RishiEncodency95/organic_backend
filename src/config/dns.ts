import dns from 'node:dns';

// Share the API's Windows resolver workaround with standalone worker processes.
// Leave working network/VPN resolvers unchanged. An explicit override is optional.
const configured = process.env.DNS_SERVERS?.split(',').map(value => value.trim()).filter(Boolean);
const servers = dns.getServers();
const isLoopback = (server: string) => server === '::1' || server === '[::1]' || /^127\./.test(server);
if (configured?.length) {
  dns.setServers(configured);
} else if (servers.length > 0 && servers.every(isLoopback)) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}
