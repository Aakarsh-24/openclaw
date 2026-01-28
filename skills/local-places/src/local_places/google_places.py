import os
import requests
from typing import List, Optional
from dotenv import load_dotenv

# Load API Key from .env
load_dotenv()
API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")

if not API_KEY:
    raise ValueError("GOOGLE_PLACES_API_KEY is not set in environment variables.")

from .schemas import (
    SearchRequest,
    SearchResponse,
    PlaceDetails,
    LocationResolveRequest,
    LocationResolveResponse,
)

BASE_URL = "https://maps.googleapis.com/maps/api/place"

def search_places(request: SearchRequest) -> SearchResponse:
    """
    Searches for places using Google Places Text Search API.
    """
    url = f"{BASE_URL}/textsearch/json"
    params = {
        "query": request.query,
        "key": API_KEY,
    }
    
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    data = resp.json()
    
    results = []
    for item in data.get("results", []):
        results.append({
            "name": item.get("name"),
            "place_id": item.get("place_id"),
            "formatted_address": item.get("formatted_address"),
            "rating": item.get("rating"),
        })
        
    return SearchResponse(results=results)

def get_place_details(place_id: str) -> PlaceDetails:
    """
    Fetches specific details for a place ID.
    """
    url = f"{BASE_URL}/details/json"
    params = {
        "place_id": place_id,
        "key": API_KEY,
        # Only fetch fields we need to save cost/latency
        "fields": "name,formatted_address,geometry,rating,formatted_phone_number,website"
    }
    
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    result = resp.json().get("result", {})
    
    return PlaceDetails(
        name=result.get("name"),
        formatted_address=result.get("formatted_address"),
        location=result.get("geometry", {}).get("location"),
        rating=result.get("rating"),
        website=result.get("website")
    )

def resolve_locations(request: LocationResolveRequest) -> LocationResolveResponse:
    """
    Reverse geocoding: Resolves lat/lng to an address.
    """
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        "latlng": request.location,
        "key": API_KEY,
    }
    
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    data = resp.json()
    
    address = "Unknown Location"
    if data.get("results"):
        address = data["results"][0].get("formatted_address")
        
    return LocationResolveResponse(resolved_address=address)
