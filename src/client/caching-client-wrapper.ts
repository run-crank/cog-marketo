import { ClientWrapper } from '../client/client-wrapper';
import { promisify } from 'util';​​
class CachingClientWrapper {
  // cachePrefix is scoped to the specific scenario, request, and requestor
  public cachePrefix = `${this.idMap.scenarioId}${this.idMap.requestorId}`;

  constructor(private client: ClientWrapper, public redisClient: any, public idMap: any) {
    this.redisClient = redisClient;
    this.idMap = idMap;
  }
​
  // lead-aware methods
  // -------------------------------------------------------------------
​
  public async findLeadByEmail(email: string, justInCaseField: string = null, partitionId: number = null) {
    const cachekey = `Marketo|Lead|${email}|${this.cachePrefix}`;
    // check cache
    const stored = await this.getCache(cachekey);
    // if not there, call findLeadByEmail in lead-aware.ts
    if (stored) {
      return stored;
    } else {
      const newLead = await this.client.findLeadByEmail(email, justInCaseField, partitionId);
      if (newLead && newLead.success && newLead.result.length && Object.keys(newLead.result[0]).length > 8 && Object.keys(newLead.result[0]).length < 1000) {
        await this.setCache(cachekey, newLead);
      }
      return newLead;
    }
  }
​
  public async findLeadByField(field: string, value: string, justInCaseField: string = null, partitionId: number = null) {
    const cachekey = `Marketo|Lead|${value}|${this.cachePrefix}`;
    // check cache
    const stored = await this.getCache(cachekey);
    // if not there, call findLeadByField in lead-aware.ts
    if (stored) {
      return stored;
    } else {
      const newLead = await this.client.findLeadByField(field, value, justInCaseField, partitionId);
      if (newLead && newLead.success && newLead.result.length && Object.keys(newLead.result[0]).length > 8 && Object.keys(newLead.result[0]).length < 1000) {
        await this.setCache(cachekey, newLead);
      }
      return newLead;
    }
  }

  public async createOrUpdateLead(lead: Record<string, any>, partitionId: number = 1) {
    await this.clearCache();
    return await this.client.createOrUpdateLead(lead, partitionId);
  }
​
  public async deleteLeadById(leadId: number, email: string = null) {
    await this.clearCache();
    return await this.client.deleteLeadById(leadId);
  }

  public async describeLeadFields(email: string = '') {
    const cachekey = `Marketo|Description|${email}|${this.cachePrefix}`;
    // check cache
    const stored = await this.getCache(cachekey);
    // if not there, call describeLeadFields in lead-aware.ts
    if (stored) {
      return stored;
    } else {
      const newLeadDescription = await this.client.describeLeadFields();
      await this.setCache(cachekey, newLeadDescription);
      return newLeadDescription;
    }
  }

  // custom-object-aware methods
  // -------------------------------------------------------------------

  public async getCustomObject(customObjectName, email: string = null) {
    const cachekey = `Marketo|Object|${email}${customObjectName}|${this.cachePrefix}`;
    // check cache
    const stored = await this.getCache(cachekey);
    // if not there, call getCustomObject in custom-object-aware.ts
    if (stored) {
      return stored;
    } else {
      const newCustomObject = await this.client.getCustomObject(customObjectName);
      if (newCustomObject && newCustomObject.success && newCustomObject.result.length) {
        await this.setCache(cachekey, newCustomObject);
      }
      return newCustomObject;
    }
  }

  public async queryCustomObject(customObjectName, filterType, searchFields: any[], requestFields: string[] = [], email: string = '') {
    const cachekey = `Marketo|Query|${email}${customObjectName}|${this.cachePrefix}`;
    // check cache
    const stored = await this.getCache(cachekey);
    // if not there, call queryCustomObject in custom-object-aware.ts
    if (stored) {
      return stored;
    } else {
      const newCustomObjectQuery = await this.client.queryCustomObject(customObjectName, filterType, searchFields, requestFields);
      if (newCustomObjectQuery && newCustomObjectQuery.success && newCustomObjectQuery.result.length) {
        await this.setCache(cachekey, newCustomObjectQuery);
      }
      return newCustomObjectQuery;
    }
  }

  public async createOrUpdateCustomObject(customObjectName, customObject: Record<string, any>) {
    await this.clearCache();
    return await this.client.createOrUpdateCustomObject(customObjectName, customObject);
  }

  public async deleteCustomObjectById(customObjectName, customObjectGUID, email: string = '') {
    await this.clearCache();
    return await this.client.deleteCustomObjectById(customObjectName, customObjectGUID);
  }

  // smart-campaign-aware methods
  // -------------------------------------------------------------------
  // Campaigns will be cached with cacheKey = cachePrefix + 'Campaigns'

  public async getCampaigns() {
    const cachekey = `Marketo|Campaigns|${this.cachePrefix}`;
    // check cache
    const stored = await this.getCache(cachekey);
    // if not there, call getCampaigns in smart-campaign-aware.ts
    if (stored) {
      return stored;
    } else {
      const campaigns = await this.client.getCampaigns();
      if (campaigns && campaigns.length) {
        await this.setCache(cachekey, campaigns);
      }
      return campaigns;
    }
  }

  public async addLeadToSmartCampaign(campaignId: string, lead: Record<string, any>) {
    await this.clearCache();
    return await this.client.addLeadToSmartCampaign(campaignId, lead);
  }

  // all non-cached functions, just referencing the original function
  // -------------------------------------------------------------------

  public async getActivityTypes() {
    return await this.client.getActivityTypes();
  }

  public async getActivityPagingToken(sinceDate) {
    return await this.client.getActivityPagingToken(sinceDate);
  }

  public async getActivities(nextPageToken, leadId, activityId) {
    return await this.client.getActivities(nextPageToken, leadId, activityId);
  }

  public async getDailyApiUsage() {
    return await this.client.getDailyApiUsage();
  }

  public async getWeeklyApiUsage() {
    return await this.client.getWeeklyApiUsage();
  }

  // Redis methods for get, set, and delete
  // -------------------------------------------------------------------

  // Async getter/setter
  public getAsync = promisify(this.redisClient.get).bind(this.redisClient);
  public setAsync = promisify(this.redisClient.setex).bind(this.redisClient);
  public delAsync = promisify(this.redisClient.del).bind(this.redisClient);

  public async getCache(key: string) {
    try {
      const stored = await this.getAsync(key);
      if (stored) {
        return JSON.parse(stored);
      }
      return null;
    } catch (err) {
      console.log(err);
    }
  }

  public async setCache(key: string, value: any) {
    try {
      // arrOfKeys will store an array of all cache keys used in this scenario run, so it can be cleared easily
      const arrOfKeys = await this.getCache(`cachekeys|${this.cachePrefix}`) || [];
      arrOfKeys.push(key);
      await this.setAsync(key, 600, JSON.stringify(value));
      await this.setAsync(`cachekeys|${this.cachePrefix}`, 600, JSON.stringify(arrOfKeys));
    } catch (err) {
      console.log(err);
    }
  }

  public async clearCache() {
    try {
      // clears all the cachekeys used in this scenario run
      const keysToDelete = await this.getCache(`cachekeys|${this.cachePrefix}`) || [];
      if (keysToDelete.length) {
        keysToDelete.forEach(async (key: string) => await this.delAsync(key));
      }
      await this.setAsync(`cachekeys|${this.cachePrefix}`, 600, '[]');
    } catch (err) {
      console.log(err);
    }
  }

}
​
export { CachingClientWrapper as CachingClientWrapper };
