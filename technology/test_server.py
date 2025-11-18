#!/usr/bin/env python3
"""
OCR Server Connection Test Script
This script helps diagnose connection issues with the OCR server.
"""

import requests
import socket
import subprocess
import sys
import json

def test_localhost():
    """Test if server responds on localhost"""
    print("Testing localhost connection...")
    try:
        response = requests.get("http://localhost:5000", timeout=5)
        print(f"✅ Localhost connection successful: {response.status_code}")
        return True
    except Exception as e:
        print(f"❌ Localhost connection failed: {e}")
        return False

def test_network_ip():
    """Test if server responds on network IP"""
    print("Testing network IP connection...")
    try:
        # Get current IP
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
        print(f"Current IP: {local_ip}")
        
        response = requests.get(f"http://{local_ip}:5000", timeout=5)
        print(f"✅ Network IP connection successful: {response.status_code}")
        return True
    except Exception as e:
        print(f"❌ Network IP connection failed: {e}")
        return False

def check_port_listening():
    """Check if port 5000 is listening"""
    print("Checking if port 5000 is listening...")
    try:
        result = subprocess.run(['netstat', '-an'], capture_output=True, text=True)
        if ':5000' in result.stdout:
            print("✅ Port 5000 is listening")
            return True
        else:
            print("❌ Port 5000 is not listening")
            return False
    except Exception as e:
        print(f"❌ Error checking port: {e}")
        return False

def test_ocr_endpoint():
    """Test OCR endpoint with a simple request"""
    print("Testing OCR endpoints...")
    try:
        # Test direct endpoint
        response = requests.get("http://localhost:5000/ocr/direct", timeout=5)
        print(f"OCR Direct endpoint status: {response.status_code}")
        
        if response.status_code == 405:  # Method Not Allowed is expected for GET
            print("✅ OCR endpoint is responding (405 expected for GET request)")
            return True
        else:
            print(f"⚠️  Unexpected response: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ OCR endpoint test failed: {e}")
        return False

def get_network_info():
    """Get network configuration info"""
    print("\n=== Network Information ===")
    try:
        result = subprocess.run(['ipconfig'], capture_output=True, text=True)
        lines = result.stdout.split('\n')
        for line in lines:
            if 'IPv4 Address' in line or 'Default Gateway' in line:
                print(line.strip())
    except Exception as e:
        print(f"Error getting network info: {e}")

def main():
    print("🔍 OCR Server Connection Diagnostics")
    print("=" * 40)
    
    # Get network info first
    get_network_info()
    print()
    
    # Run tests
    tests = [
        check_port_listening,
        test_localhost,
        test_network_ip,
        test_ocr_endpoint
    ]
    
    results = []
    for test in tests:
        result = test()
        results.append(result)
        print()
    
    # Summary
    print("=" * 40)
    print("📋 Test Summary:")
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    
    if passed == total:
        print("🎉 All tests passed! OCR server should be accessible.")
    else:
        print("⚠️  Some tests failed. Check the issues above.")
        print("\n💡 Troubleshooting tips:")
        print("1. Ensure OCR server is running: python ocr_server.py")
        print("2. Check Windows Firewall settings for port 5000")
        print("3. Verify mobile device is on the same network")
        print("4. Try restarting the OCR server")

if __name__ == "__main__":
    main()
