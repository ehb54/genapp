#ifndef __application___UTILITY_ROUTINES_H
#define __application___UTILITY_ROUTINES_H

#include <qstring.h>
#include <qregexp.h>
#include <qmap.h>
#include <qvector.h>
#include <qdatetime.h>
#include <qdir.h>
#include <qdebug.h>

using namespace std;

struct plotData {
   QVector < double > x;
   QVector < double > y;
};

class UTILITY_JSON
{
 public:
   static QMap < QString, QString > split( QString );
   static QString                   compose( QMap < QString, QString > & );
   static QVector < plotData > *    array_string_to_qvv( const QString & s );
};

class UTILITY
{
 public:
   static QString unique_directory( const QString & basedir );
};

#endif
