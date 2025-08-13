// Initialize Supabase client
const supabaseUrl = 'https://your-project-url.supabase.co';
const supabaseKey = 'your-anon-key';
const supabase = supabaseJs.createClient(supabaseUrl, supabaseKey);

// Fetch airports
async function fetchAirports() {
  const { data, error } = await supabase
    .from('charter.airports')
    .select('*')
    .order('city');
    
  if (error) {
    console.error('Error fetching airports:', error);
    return [];
  }
  
  return data || [];
}

// Fetch aircraft types
async function fetchAircraftTypes() {
  const { data, error } = await supabase
    .from('charter.aircraft_types')
    .select('*')
    .order('category');
    
  if (error) {
    console.error('Error fetching aircraft types:', error);
    return [];
  }
  
  return data || [];
}

// Fetch extras
async function fetchExtras() {
  const { data, error } = await supabase
    .from('charter.extras')
    .select('*')
    .order('category');
    
  if (error) {
    console.error('Error fetching extras:', error);
    return [];
  }
  
  return data || [];
}

// Get quote from Edge Function
async function getQuote(quoteData) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/charter-quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify(quoteData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching quote:', error);
    throw error;
  }
}

// Track quote generation for analytics
async function trackQuoteGeneration(quoteId, success, details) {
  try {
    await supabase
      .from('charter.analytics')
      .insert({
        event_type: 'quote_generated',
        quote_id: quoteId,
        success,
        details,
        timestamp: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error tracking quote:', error);
  }
}
