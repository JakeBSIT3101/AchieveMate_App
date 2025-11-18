#!/usr/bin/env python3
"""
Test script to demonstrate course title spacing fixes
"""

import re

def fix_course_title_spacing(title):
    """Fix spacing issues in course titles by adding spaces between words"""
    
    # Remove extra spaces first
    title = re.sub(r'\s+', ' ', title.strip())
    
    # Add space before capital letters that follow lowercase letters
    # e.g., "AnalyticsApplication" -> "Analytics Application"
    title = re.sub(r'([a-z])([A-Z])', r'\1 \2', title)
    
    # Add space before numbers that follow letters
    # e.g., "Project2" -> "Project 2"
    title = re.sub(r'([a-zA-Z])(\d)', r'\1 \2', title)
    
    # Add space after numbers that are followed by letters
    # e.g., "2Advanced" -> "2 Advanced"
    title = re.sub(r'(\d)([a-zA-Z])', r'\1 \2', title)
    
    # Fix common OCR issues
    replacements = {
        'andProfessional': 'and Professional',
        'QualityAssurance': 'Quality Assurance',
        'InformationAssurance': 'Information Assurance',
        'andSecurity': 'and Security',
        'SocialIssues': 'Social Issues',
        'PlatformTechnologies': 'Platform Technologies',
        'CapstoneProject': 'Capstone Project',
        'DatabaseManagement': 'Database Management',
        'ManagementSystem': 'Management System',
        'ComputerNetworking': 'Computer Networking',
        'DataAnalysis': 'Data Analysis',
        'TeamSports': 'Team Sports',
        'EnvironmentalSciences': 'Environmental Sciences'
    }
    
    for old, new in replacements.items():
        title = title.replace(old, new)
    
    # Clean up multiple spaces
    title = re.sub(r'\s+', ' ', title).strip()
    
    return title

def main():
    print("🔧 Course Title Spacing Fix Test")
    print("=" * 50)
    
    # Test cases from your OCR results
    test_titles = [
        "AnalyticsApplication",
        "SocialIssues and Professional Practice",
        "Technopreneurship",
        "CapstoneProject2",
        "PlatformTechnologies",
        "Advanced InformationAssurance andSecurity",
        "SystemsQualityAssurance",
        "ComputerNetworking2",
        "DataAnalysis",
        "TeamSports"
    ]
    
    print("Before → After")
    print("-" * 50)
    
    for title in test_titles:
        fixed_title = fix_course_title_spacing(title)
        print(f"{title:<35} → {fixed_title}")
    
    print("\n✅ All titles have been fixed with proper spacing!")

if __name__ == "__main__":
    main()
