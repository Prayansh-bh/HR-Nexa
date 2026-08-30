import { Injectable } from '@nestjs/common';

export interface UserAgentMetadata {
  browser: string;
  os: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
}

@Injectable()
export class UserAgentParserService {
  parse(userAgent?: string): UserAgentMetadata {
    if (!userAgent) {
      return { browser: 'Unknown Browser', os: 'Unknown OS', deviceType: 'Desktop' };
    }

    const ua = userAgent.toLowerCase();

    // Browser Detection
    let browser = 'Unknown Browser';
    if (ua.includes('edg/')) browser = 'Microsoft Edge';
    else if (ua.includes('chrome/')) browser = 'Google Chrome';
    else if (ua.includes('firefox/')) browser = 'Mozilla Firefox';
    else if (ua.includes('safari/')) browser = 'Apple Safari';
    else if (ua.includes('opera/') || ua.includes('opr/')) browser = 'Opera';

    // OS Detection
    let os = 'Unknown OS';
    if (ua.includes('win')) os = 'Windows';
    else if (ua.includes('mac')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) os = 'iOS';

    // Device Type Detection
    let deviceType: 'Desktop' | 'Mobile' | 'Tablet' = 'Desktop';
    if (ua.includes('ipad') || ua.includes('tablet')) {
      deviceType = 'Tablet';
    } else if (ua.includes('mobi') || ua.includes('android') || ua.includes('iphone')) {
      deviceType = 'Mobile';
    }

    return { browser, os, deviceType };
  }
}
