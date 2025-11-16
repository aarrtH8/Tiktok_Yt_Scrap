#!/usr/bin/env python3
"""
Test script for the YouTube to TikTok backend
Tests all API endpoints and functionality
"""

import requests
import json
import time
import sys

API_BASE = "http://localhost:5000"

def test_health():
    """Test the health check endpoint"""
    print("Testing health check...")
    try:
        response = requests.get(f"{API_BASE}/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed")
            print(f"   FFmpeg: {data['services']['ffmpeg']}")
            print(f"   yt-dlp: {data['services']['yt-dlp']}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_detect_video():
    """Test video detection"""
    print("\nTesting video detection...")
    try:
        # Test with a short, public YouTube video
        test_url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"  # "Me at the zoo" - First YouTube video
        
        response = requests.post(
            f"{API_BASE}/api/detect-video",
            json={"urls": [test_url]},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data['videos'] and len(data['videos']) > 0:
                video = data['videos'][0]
                print(f"✅ Video detection passed")
                print(f"   Title: {video['title']}")
                print(f"   Duration: {video['durationFormatted']}")
                print(f"   Channel: {video['channel']}")
                return video['id']
            else:
                print("❌ No videos detected")
                return None
        else:
            print(f"❌ Video detection failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Video detection error: {e}")
        return None

def test_full_workflow():
    """Test the complete workflow (warning: takes time)"""
    print("\n⚠️  Full workflow test (this will download a video)")
    print("This test will take several minutes...")
    
    response = input("Do you want to proceed? (yes/no): ")
    if response.lower() != 'yes':
        print("Skipping full workflow test")
        return
    
    try:
        # Test URL
        test_url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"
        
        # Step 1: Detect video
        print("\n1. Detecting video...")
        detect_response = requests.post(
            f"{API_BASE}/api/detect-video",
            json={"urls": [test_url]},
            headers={"Content-Type": "application/json"}
        )
        
        if detect_response.status_code != 200:
            print(f"❌ Detection failed: {detect_response.status_code}")
            return
        
        videos = detect_response.json()['videos']
        print(f"✅ Video detected: {videos[0]['title']}")
        
        # Step 2: Process video
        print("\n2. Processing video (this takes time)...")
        process_response = requests.post(
            f"{API_BASE}/api/process-video",
            json={
                "videos": videos,
                "settings": {
                    "duration": 15,  # Short duration for testing
                    "quality": "480p",  # Lower quality for speed
                    "autoDetect": True
                }
            },
            headers={"Content-Type": "application/json"},
            timeout=600  # 10 minutes timeout
        )
        
        if process_response.status_code != 200:
            print(f"❌ Processing failed: {process_response.status_code}")
            print(f"   Response: {process_response.text}")
            return
        
        process_data = process_response.json()
        session_id = process_data['sessionId']
        print(f"✅ Processing complete")
        print(f"   Session ID: {session_id}")
        print(f"   Moments detected: {len(process_data['moments'])}")
        
        # Step 3: Download video
        print("\n3. Compiling and downloading video...")
        download_response = requests.post(
            f"{API_BASE}/api/download-video",
            json={
                "sessionId": session_id,
                "quality": "480p"
            },
            headers={"Content-Type": "application/json"},
            timeout=600,
            stream=True
        )
        
        if download_response.status_code != 200:
            print(f"❌ Download failed: {download_response.status_code}")
            print(f"   Response: {download_response.text}")
            return
        
        # Save the file
        output_file = "test_compilation.mp4"
        with open(output_file, 'wb') as f:
            for chunk in download_response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        print(f"✅ Video compilation complete")
        print(f"   Saved to: {output_file}")
        print(f"   File size: {len(open(output_file, 'rb').read()) / (1024*1024):.2f} MB")
        
        print("\n✅ Full workflow test passed!")
        
    except Exception as e:
        print(f"❌ Full workflow error: {e}")
        import traceback
        traceback.print_exc()

def main():
    """Run all tests"""
    print("=" * 60)
    print("YouTube to TikTok Backend Test Suite")
    print("=" * 60)
    
    # Check if backend is running
    print("\nChecking if backend is running...")
    try:
        requests.get(f"{API_BASE}/health", timeout=5)
        print("✅ Backend is running")
    except Exception as e:
        print(f"❌ Backend is not running on {API_BASE}")
        print("   Please start the backend first: python server.py")
        sys.exit(1)
    
    # Run tests
    tests = [
        ("Health Check", test_health),
        ("Video Detection", test_detect_video),
    ]
    
    results = []
    for test_name, test_func in tests:
        print("\n" + "=" * 60)
        result = test_func()
        results.append((test_name, result))
    
    # Optional full workflow test
    print("\n" + "=" * 60)
    test_full_workflow()
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    print("\n" + "=" * 60)
    print("Tests complete!")
    print("=" * 60)

if __name__ == "__main__":
    main()
