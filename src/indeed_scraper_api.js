import https from 'https';

/**
 * Indeed Scraper API implementation for comprehensive job collection
 * Uses city-based searches with 100-mile radius for maximum coverage
 * Maps fields to match rapidapi_jobs database schema
 */

// Comprehensive city list for maximum US coverage
const MAJOR_CITIES = [
    // Original Major Cities
    'New York, NY',        // Northeast: NY, NJ, PA, CT
    'Boston, MA',          // New England: MA, NH, CT, RI
    'Chicago, IL',         // Midwest: IL, IN, WI, MI
    'Los Angeles, CA',     // West Coast: CA metro
    'Dallas, TX',          // South Central: TX metro
    'Atlanta, GA',         // Southeast: GA, AL, TN, SC
    'Seattle, WA',         // Pacific Northwest: WA, OR
    'Miami, FL',           // Southeast: FL metro
    'Denver, CO',          // Mountain West: CO, WY, NM
    'Phoenix, AZ',         // Southwest: AZ, NV
    'Philadelphia, PA',    // Mid-Atlantic: PA, DE, NJ
    'Houston, TX',         // Texas Gulf: TX metro
    'Detroit, MI',         // Great Lakes: MI, OH
    'Minneapolis, MN',     // Upper Midwest: MN, WI, IA
    'San Francisco, CA',   // Northern CA: CA Bay Area
    'Las Vegas, NV',       // Nevada: NV, UT
    'Portland, OR',        // Pacific Northwest: OR, WA
    'Charlotte, NC',       // Carolinas: NC, SC
    'Nashville, TN',       // Mid-South: TN, KY
    'New Orleans, LA',     // Gulf Coast: LA, MS, AL

    // Midwest & Plains
    'Kansas City, MO',     // Missouri, Kansas
    'Omaha, NE',          // Nebraska
    'Fargo, ND',          // North Dakota
    'Sioux Falls, SD',    // South Dakota
    'Des Moines, IA',     // Iowa
    'Indianapolis, IN',   // Indiana
    'Columbus, OH',       // Ohio
    'Milwaukee, WI',      // Wisconsin

    // Northeast & Mid-Atlantic (Additional)
    'Providence, RI',     // Rhode Island
    'Hartford, CT',       // Connecticut
    'Manchester, NH',     // New Hampshire
    'Portland, ME',       // Maine
    'Wilmington, DE',     // Delaware
    'Pittsburgh, PA',     // Western Pennsylvania
    'Buffalo, NY',        // Upstate New York
    'Newark, NJ',         // New Jersey

    // Southeast & South Central (Additional)
    'Louisville, KY',     // Kentucky
    'Birmingham, AL',     // Alabama
    'Jackson, MS',        // Mississippi
    'Little Rock, AR',    // Arkansas
    'Charleston, WV',     // West Virginia
    'Lexington, KY',      // Central Kentucky

    // West & Southwest (Additional)
    'Salt Lake City, UT', // Utah
    'Albuquerque, NM',    // New Mexico
    'Boise, ID',          // Idaho
    'Billings, MT',       // Montana
    'Cheyenne, WY',       // Wyoming
    'Anchorage, AK',      // Alaska
    'Honolulu, HI',       // Hawaii

    // Pacific & West Coast (Additional)
    'San Jose, CA',       // Silicon Valley
    'Sacramento, CA',     // California Capital Region
    'Spokane, WA',        // Eastern Washington
    'Eugene, OR',         // Western Oregon

    // South Atlantic & Southeast (Additional)
    'Tampa, FL',          // Gulf Coast Florida
    'Orlando, FL',        // Central Florida
    'Raleigh, NC',        // Research Triangle
    'Columbia, SC',       // South Carolina Capital Region
    'Richmond, VA',       // Central Virginia
    'Virginia Beach, VA', // Hampton Roads

    // Appalachia & Interior South
    'Huntsville, AL',     // Northern Alabama
    'Knoxville, TN',      // East Tennessee
    'Chattanooga, TN',    // Southeastern Tennessee

    // Texas (Additional)
    'Austin, TX',         // Central Texas
    'San Antonio, TX',    // South Central Texas
    'El Paso, TX'         // West Texas
];

// Comprehensive job search query targeting management and leadership positions
const JOB_SEARCH_TERMS = [
    "Restaurant Manager OR General Manager OR Assistant General Manager OR Executive Chef OR Sous Chef OR Pastry Chef OR Kitchen Manager OR Food and Beverage Manager OR Culinary Director OR Director of Operations OR Restaurant Group Manager OR Banquet Manager OR Catering Manager OR Hospitality Manager OR Bar Manager OR Beverage Director OR Wine Director OR Sommelier OR Dining Room Manager OR Service Director OR Hotel General Manager OR Hotel Manager OR Resident Manager OR Front Office Manager OR Housekeeping Manager OR Concierge Manager OR Reservations Manager OR Revenue Manager OR Sales Manager OR Marketing Manager OR Event Manager OR Banquet Director OR Spa Manager OR Wellness Director OR Director of Housekeeping OR Director of Rooms OR Night Manager OR Hotel Operations Manager OR Estate Manager OR House Manager OR Private Chef OR Executive Housekeeper OR Butler OR Chauffeur OR Personal Assistant OR Nanny OR Household Manager OR Property Manager OR Private Security Manager OR Director of Residences OR Valet Manager OR Personal Concierge"
];

/**
 * Make API request with retry logic for rate limiting
 */
async function makeIndeedScraperRequestWithRetry(requestBody, city, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await makeIndeedScraperRequest(requestBody);

            if (result.status === 429) {
                const waitTime = Math.min(60 * attempt, 300); // Exponential backoff, max 5 minutes
                console.log(`  ⚠️  Rate limit hit for ${city} (attempt ${attempt}/${maxRetries}). Waiting ${waitTime} seconds...`);
                await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                continue;
            }

            return result;

        } catch (error) {
            if (attempt === maxRetries) {
                throw error;
            }
            console.log(`  ⚠️  Request failed for ${city} (attempt ${attempt}/${maxRetries}): ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds before retry
        }
    }

    throw new Error(`Failed after ${maxRetries} attempts`);
}

/**
 * Make API request to Indeed Scraper
 */
function makeIndeedScraperRequest(requestBody) {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'POST',
            hostname: 'indeed-scraper-api.p.rapidapi.com',
            port: null,
            path: '/api/job',
            headers: {
                'x-rapidapi-key': process.env.RAPIDAPI_KEY || '26f8494ae3msh6105ec8e9f487c4p1e4693jsndc74e2a6561c',
                'x-rapidapi-host': 'indeed-scraper-api.p.rapidapi.com',
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, function (res) {
            const chunks = [];

            res.on('data', function (chunk) {
                chunks.push(chunk);
            });

            res.on('end', function () {
                const responseBody = Buffer.concat(chunks);
                try {
                    const data = JSON.parse(responseBody.toString());
                    resolve({ status: res.statusCode, data });
                } catch (error) {
                    resolve({ status: res.statusCode, data: responseBody.toString() });
                }
            });
        });

        req.on('error', reject);
        req.write(JSON.stringify(requestBody));
        req.end();
    });
}

/**
 * Extract domain from URL
 */
function getDomainFromUrl(url) {
    if (!url) return '';
    try {
        const parsedUrl = new URL(url.startsWith('http') ? url : `http://${url}`);
        let domain = parsedUrl.hostname;
        if (domain.startsWith('www.')) {
            domain = domain.substring(4);
        }
        return domain;
    } catch (error) {
        return '';
    }
}

/**
 * Format salary information into a readable string
 */
function formatSalaryString(salaryData) {
    if (!salaryData) return '';

    // If there's already a salaryText, use it
    if (salaryData.salaryText) return salaryData.salaryText;

    const { salaryMin, salaryMax, salaryType, salaryCurrency } = salaryData;

    if (!salaryMin && !salaryMax) return '';

    // Round off numbers to no decimals
    const minRounded = salaryMin ? Math.round(salaryMin) : null;
    const maxRounded = salaryMax ? Math.round(salaryMax) : null;

    // Format currency (default to USD)
    const currency = salaryCurrency === 'USD' ? '$' : salaryCurrency;

    // Format type
    const typeText = salaryType === 'yearly' ? 'a year' :
                    salaryType === 'hourly' ? 'an hour' :
                    salaryType === 'monthly' ? 'a month' : '';

    // Build salary string
    if (minRounded && maxRounded) {
        return `${currency}${minRounded.toLocaleString()} - ${currency}${maxRounded.toLocaleString()}${typeText ? ' ' + typeText : ''}`;
    } else if (minRounded) {
        return `${currency}${minRounded.toLocaleString()}${typeText ? ' ' + typeText : ''}`;
    } else if (maxRounded) {
        return `Up to ${currency}${maxRounded.toLocaleString()}${typeText ? ' ' + typeText : ''}`;
    }

    return '';
}



/**
 * Normalize job data from Indeed Scraper API
 */
function normalizeIndeedScraperJob(job, searchTerm, city) {
    return {
        // Basic job info - keep original title, use API company name
        title: job.title || 'No title',
        company: job.companyName || job.company || 'Company not specified',
        location: job.location?.formattedAddressShort || job.location?.fullAddress || 'Location not specified',
        
        // URLs and IDs
        url: job.applyUrl || job.jobUrl || '',
        apply_link: job.applyUrl || job.jobUrl || '',
        job_id: job.jobKey || '',
        
        // Salary information - format as single readable string
        salary: formatSalaryString(job.salary) || job.salaryText || '',
        salary_min: job.salary?.salaryMin ? Math.round(job.salary.salaryMin) : null,
        salary_max: job.salary?.salaryMax ? Math.round(job.salary.salaryMax) : null,
        salary_type: job.salary?.salaryType || '',
        salary_currency: job.salary?.salaryCurrency || 'USD',
        
        // Job details
        job_type: Array.isArray(job.jobType) ? job.jobType.join(', ') : (job.jobType || 'Full-time'),
        description: job.descriptionHtml || job.description || '',
        
        // Location details
        city: job.location?.city || '',
        state: job.location?.formattedAddressShort?.split(', ')[1] || '',
        country: job.location?.country || 'United States',
        latitude: job.location?.latitude || null,
        longitude: job.location?.longitude || null,
        
        // Company details
        company_size: job.companyRevenue || job.companyNumEmployees || '',

        // Search metadata
        search_term: searchTerm,
        search_city: city,
        source: 'indeed_scraper_api',
        scraped_at: new Date().toISOString(),
        
        // Contact info (extract from description if available)
        emails: extractEmailsFromText(job.descriptionHtml || job.description || ''),
        
        // Additional fields for compatibility
        posted_date: job.postedDate || job.datePublished || '',
        company_url: job.companyUrl || job.companyLinks?.corporateWebsite || '',
        company_website: job.companyLinks?.corporateWebsite || '', // Direct from API
        company_domain: job.companyLinks?.corporateWebsite ? getDomainFromUrl(job.companyLinks.corporateWebsite) : '',
        remote: job.remote || job.isRemote || false
    };
}

/**
 * Extract email addresses from job description text
 */
function extractEmailsFromText(text) {
    if (!text) return [];
    
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailRegex) || [];
    
    // Filter out common non-contact emails
    const filteredEmails = emails.filter(email => {
        const lowerEmail = email.toLowerCase();
        return !lowerEmail.includes('noreply') && 
               !lowerEmail.includes('no-reply') &&
               !lowerEmail.includes('donotreply') &&
               !lowerEmail.includes('support') &&
               !lowerEmail.includes('help');
    });
    
    return [...new Set(filteredEmails)]; // Remove duplicates
}



/**
 * Main function to scrape jobs using Indeed Scraper API
 */
export async function scrapeJobsWithIndeedScraper(options = {}) {
    const {
        testMode = false,
        minSalary = 55000,
        maxCities = testMode ? 2 : MAJOR_CITIES.length,
        searchTerms = JOB_SEARCH_TERMS,
        jobAgeDays = 1 // Default to 1 day for daily runs, can be set to 7 for initial runs
    } = options;
    
    // Validate jobAgeDays - API only accepts 1, 3, 7, 14
    const validJobAgeDays = [1, 3, 7, 14];
    const validatedJobAgeDays = validJobAgeDays.includes(jobAgeDays) ? jobAgeDays : 7;

    if (validatedJobAgeDays !== jobAgeDays) {
        console.log(`⚠️  Invalid jobAgeDays value: ${jobAgeDays}. Using ${validatedJobAgeDays} instead.`);
        console.log(`📋 Valid values are: ${validJobAgeDays.join(', ')}`);
    }

    console.log('🚀 Starting Indeed Scraper API job collection...');
    console.log(`📋 Using comprehensive OR query targeting management positions`);
    console.log(`🏙️ Cities to search: ${maxCities} (${testMode ? 'TEST MODE' : 'FULL MODE'})`);
    console.log(`💰 Minimum salary: $${minSalary.toLocaleString()}`);
    console.log(`📅 Job age filter: ${validatedJobAgeDays} days`);
    console.log(`🎯 Total API calls: ${maxCities} (1 comprehensive query per city)`);
    console.log(`⏱️  Estimated time: ${Math.ceil(maxCities * 15 / 60)} minutes (15 sec between requests for rate limiting)`);
    
    const allJobs = [];
    const citiesToSearch = MAJOR_CITIES.slice(0, maxCities);
    
    for (let cityIndex = 0; cityIndex < citiesToSearch.length; cityIndex++) {
        const city = citiesToSearch[cityIndex];
        console.log(`\n🏙️ Searching in ${city} (${cityIndex + 1}/${citiesToSearch.length})`);
        
        for (let termIndex = 0; termIndex < searchTerms.length; termIndex++) {
            const searchTerm = searchTerms[termIndex];
            console.log(`  🔍 Searching for management positions...`);
            
            try {
                const requestBody = {
                    scraper: {
                        maxRows: 100, // Maximum jobs per request
                        query: searchTerm,
                        location: city,
                        jobType: 'fulltime',
                        radius: '100', // Maximum allowed radius
                        sort: 'date', // Sort by date to get newest jobs first
                        fromDays: validatedJobAgeDays.toString(), // Use validated job age (7 for initial, 1 for daily)
                        country: 'us'
                    }
                };

                const result = await makeIndeedScraperRequestWithRetry(requestBody, city);
                
                if (result.status === 201 && result.data.returnvalue?.data) {
                    const jobs = result.data.returnvalue.data;
                    console.log(`  ✅ Found ${jobs.length} jobs`);
                    
                    // Normalize job data
                    const normalizedJobs = jobs.map(job => normalizeIndeedScraperJob(job, searchTerm, city));

                    allJobs.push(...normalizedJobs);
                    
                    // Show sample job
                    if (normalizedJobs.length > 0) {
                        const sampleJob = normalizedJobs[0];
                        console.log(`  📄 Sample: ${sampleJob.title} at ${sampleJob.company} - ${sampleJob.salary || 'Salary not specified'}`);
                    }
                    
                } else {
                    console.log(`  ❌ Request failed: ${result.status}`);
                    if (result.data?.message) {
                        console.log(`  📄 Error: ${result.data.message}`);
                    }
                }
                
            } catch (error) {
                console.log(`  ❌ Error searching "${searchTerm}" in ${city}: ${error.message}`);
            }
            
            // Rate limiting: wait between requests (5 requests per minute = 12 seconds between requests)
            if (termIndex < searchTerms.length - 1 || cityIndex < citiesToSearch.length - 1) {
                console.log(`  ⏱️ Waiting 15 seconds (rate limit: 5 requests/minute)...`);
                await new Promise(resolve => setTimeout(resolve, 15000)); // 15 seconds to be safe
            }
        }
    }
    
    // Remove duplicates based on company + title combination (more effective for overlapping city searches)
    const uniqueJobs = [];
    const seenJobs = new Set();
    let duplicateCount = 0;

    for (const job of allJobs) {
        // Create a unique key from company and title (case-insensitive, trimmed)
        const company = (job.company || 'unknown').toLowerCase().trim();
        const title = (job.title || 'unknown').toLowerCase().trim();
        const jobKey = `${company}|${title}`;

        if (!seenJobs.has(jobKey)) {
            seenJobs.add(jobKey);
            uniqueJobs.push(job);
        } else {
            duplicateCount++;
            // Only log first few duplicates to avoid spam
            if (duplicateCount <= 5) {
                console.log(`  🔄 Duplicate: "${job.title}" at "${job.company}"`);
            }
        }
    }
    
    console.log(`\n📊 Collection Summary:`);
    console.log(`  🎯 Total jobs found: ${allJobs.length}`);
    console.log(`  🆕 Unique jobs (by company+title): ${uniqueJobs.length}`);
    console.log(`  🔄 Duplicates removed: ${duplicateCount}`);
    console.log(`  🏙️ Cities searched: ${citiesToSearch.length}`);
    console.log(`  📋 Search terms: ${searchTerms.length}`);
    if (duplicateCount > 5) {
        console.log(`  ℹ️  (${duplicateCount - 5} more duplicates not shown)`);
    }
    
    // Show jobs with contact info
    const jobsWithEmails = uniqueJobs.filter(job => job.emails && job.emails.length > 0);
    console.log(`  📧 Jobs with email contacts: ${jobsWithEmails.length}`);
    
    return uniqueJobs;
}

export default {
    scrapeJobsWithIndeedScraper,
    MAJOR_CITIES,
    JOB_SEARCH_TERMS
};
