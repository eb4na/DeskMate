Pod::Spec.new do |s|
  s.name           = 'SyllabusReader'
  s.version        = '1.0.0'
  s.summary        = 'On-device text extraction (PDFKit + Vision) for syllabus import'
  s.description    = 'Reads text out of PDFs and photos on device, with no network.'
  s.author         = ''
  s.homepage       = 'https://memobun.app'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'PDFKit', 'Vision'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = "**/*.{h,m,mm,swift}"
end
