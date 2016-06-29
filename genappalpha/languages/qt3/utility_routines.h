#ifndef __application___UTILITY_ROUTINES_H
#define __application___UTILITY_ROUTINES_H

#include <qstring.h>
#include <qregexp.h>
#include <qmap.h>
#include <qvaluevector.h>
#include <qdatetime.h>
#include <qdir.h>

using namespace std;

struct plotData {
   QValueVector < double > x;
   QValueVector < double > y;
};

class UTILITY_JSON
{
 public:
   static QMap < QString, QString > split( QString );
   static QString compose( QMap < QString, QString > & );
   static QValueVector < plotData > * array_string_to_qvv( const QString & s );
};

class UTILITY
{
 public:
   static QString unique_directory( const QString & basedir );
};

#endif
